import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError, AppError } from "../../common/AppError.js";
import { generatePaymentReference } from "../../common/utils/numbers.js";
import { createLedgerEntry, updateShopOutstanding } from "../ledger/ledger.service.js";
import { config } from "../../config/index.js";

const processedWebhooks = new Set<string>();

export async function createPayment(data: {
  shopId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: string;
  paymentDate?: Date;
  notes?: string;
  idempotencyKey?: string;
}) {
  const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  if (data.idempotencyKey) {
    const existing = await prisma.payment.findFirst({
      where: { transactionId: data.idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  let invoice;
  if (data.invoiceId) {
    invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });
    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }
    if (invoice.shopId !== data.shopId) {
      throw new AppError("Invoice does not belong to this shop", 400);
    }
  }

  const paymentReference = await generatePaymentReference();
  const payment = await prisma.payment.create({
    data: {
      paymentReference,
      shopId: data.shopId,
      invoiceId: data.invoiceId,
      amount: new Prisma.Decimal(data.amount),
      paymentMethod: data.paymentMethod as never,
      paymentStatus: "PENDING",
      transactionId: data.idempotencyKey,
      paymentDate: data.paymentDate ?? new Date(),
      notes: data.notes,
    },
    include: {
      shop: { select: { id: true, shopCode: true, shopName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  // Online payment gateway integration
  if (["UPI", "CARD", "NET_BANKING"].includes(data.paymentMethod)) {
    // For a real gateway you would call createOrder here and set pgPayUrl.
    // In sandbox/dev, simulate an immediate gateway redirect.
    return {
      payment,
      gatewayStatus: "SANDBOX",
      message: "Payment initiated. Await gateway confirmation.",
    };
  }

  // Offline payment methods (CASH, CHEQUE, NEFT) wait for admin confirmation.
  return { payment, gatewayStatus: "OFFLINE", message: "Payment awaits manual confirmation." };
}

export async function listPayments(query: {
  page: number;
  limit: number;
  status?: string;
  shopId?: string;
  paymentMethod?: string;
  userRole?: string;
  shopIds?: string[];
}) {
  const where: Record<string, unknown> = {
    ...(query.status ? { paymentStatus: query.status as never } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod as never } : {}),
  };

  if (query.userRole === "SHOP_OWNER") {
    where.shopId = { in: query.shopIds ?? [] };
  } else if (query.shopId) {
    where.shopId = query.shopId;
  }

  const [total, payments] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: {
        shop: { select: { id: true, shopCode: true, shopName: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, outstandingAmount: true } },
      },
    }),
  ]);

  return { total, payments };
}

export async function getPaymentById(id: string, userRole?: string, shopIds?: string[]) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      shop: { select: { id: true, shopCode: true, shopName: true } },
      invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, outstandingAmount: true, status: true } },
      allocations: { include: { invoice: true } },
    },
  });
  if (!payment) {
    throw new NotFoundError("Payment not found");
  }
  if (userRole === "SHOP_OWNER" && !shopIds?.includes(payment.shopId)) {
    throw new AppError("You do not have access to this payment", 403);
  }
  return payment;
}

export async function handleWebhook(data: {
  event: string;
  transactionId: string;
  paymentReference?: string;
  amount?: number;
  status: "SUCCESS" | "FAILED" | "PENDING_CONFIRMATION";
  signature?: string;
}) {
  if (data.signature) {
    const expected = config.paymentWebhookSecret;
    if (expected && data.signature !== expected) {
      throw new AppError("Invalid webhook signature", 401);
    }
  }

  const dedupeKey = `${data.event}:${data.transactionId}`;
  if (processedWebhooks.has(dedupeKey)) {
    return { message: "Webhook already processed" };
  }

  let payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { transactionId: data.transactionId },
        ...(data.paymentReference ? [{ paymentReference: data.paymentReference }] : []),
      ],
    },
  });

  if (!payment) {
    throw new NotFoundError("Payment not found for webhook");
  }

  if (data.status === "SUCCESS") {
    const result = await confirmPayment(payment.id, undefined, payment.shopId);
    processedWebhooks.add(dedupeKey);
    return result;
  }

  if (data.status === "FAILED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { paymentStatus: "FAILED" },
    });
    processedWebhooks.add(dedupeKey);
    return { message: "Payment marked as failed" };
  }

  processedWebhooks.add(dedupeKey);
  return { message: "Payment pending confirmation" };
}

export async function confirmPayment(id: string, confirmedById?: string, forcedShopId?: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    throw new NotFoundError("Payment not found");
  }
  if (!["PENDING", "PENDING_CONFIRMATION", "FAILED"].includes(payment.paymentStatus)) {
    throw new ConflictError("Payment is not in a confirmable state");
  }

  const shopId = forcedShopId ?? payment.shopId;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id },
      data: {
        paymentStatus: "SUCCESS",
        confirmedBy: confirmedById,
      },
    });

    if (payment.invoiceId) {
      const invoice = await tx.invoice.findUnique({
        where: { id: payment.invoiceId },
      });
      if (invoice) {
        const newPaid = Number(invoice.paidAmount) + Number(payment.amount);
        const newOutstanding = Math.max(0, Number(invoice.totalAmount) - newPaid);
        const status =
          newOutstanding <= 0
            ? "PAID"
            : newPaid > 0
              ? "PARTIALLY_PAID"
              : invoice.status;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPrismaDecimal(newPaid),
            outstandingAmount: newPrismaDecimal(newOutstanding),
            status,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            amount: payment.amount,
          },
        });
      }
    }

    await createLedgerEntry({
      shopId,
      transactionType: "PAYMENT",
      referenceType: "PAYMENT",
      referenceId: payment.id,
      creditAmount: Number(payment.amount),
      description: `Payment ${payment.paymentReference}`,
      createdBy: confirmedById,
      tx,
    });

    await updateShopOutstanding(shopId, tx);

    return tx.payment.findUnique({
      where: { id },
      include: { invoice: true, allocations: true },
    });
  });
}

export async function rejectPayment(id: string, reason: string, rejectedById?: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    throw new NotFoundError("Payment not found");
  }
  if (!["PENDING", "PENDING_CONFIRMATION"].includes(payment.paymentStatus)) {
    throw new ConflictError("Payment is not in a rejectable state");
  }
  return prisma.payment.update({
    where: { id },
    data: {
      paymentStatus: "REJECTED",
      confirmedBy: rejectedById,
      notes: reason,
    },
  });
}

function newPrismaDecimal(value: number) {
  return new Prisma.Decimal(value);
}