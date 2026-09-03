import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError, AppError } from "../../common/AppError.js";

type Tx = Prisma.TransactionClient;

export async function createLedgerEntry(params: {
  shopId: string;
  transactionType: "INVOICE" | "PAYMENT" | "CREDIT_NOTE" | "DEBIT_NOTE" | "ADJUSTMENT" | "REFUND";
  referenceType: string;
  referenceId: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
  createdBy?: string;
  tx: Tx;
}) {
  const { shopId, transactionType, referenceType, referenceId, debitAmount = 0, creditAmount = 0, description, createdBy, tx } = params;

  const lastEntry = await tx.ledgerEntry.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  const runningBalance = (lastEntry?.runningBalance.toNumber() ?? 0) + debitAmount - creditAmount;

  return tx.ledgerEntry.create({
    data: {
      shopId,
      transactionType: transactionType as never,
      referenceType: referenceType as never,
      referenceId,
      debitAmount: new Prisma.Decimal(debitAmount),
      creditAmount: new Prisma.Decimal(creditAmount),
      runningBalance: new Prisma.Decimal(runningBalance),
      description,
      createdBy,
    },
  });
}

export async function createReversalEntry(params: {
  shopId: string;
  originalEntryId: string;
  transactionType: "ADJUSTMENT";
  referenceType: string;
  referenceId: string;
  description?: string;
  createdBy?: string;
  tx: Tx;
}) {
  const original = await params.tx.ledgerEntry.findUnique({
    where: { id: params.originalEntryId },
  });
  if (!original) {
    throw new NotFoundError("Original ledger entry not found");
  }
  if (original.isReversal) {
    throw new ConflictError("Entry is already a reversal");
  }

  const reversal = await createLedgerEntry({
    shopId: params.shopId,
    transactionType: "ADJUSTMENT",
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    debitAmount: original.creditAmount.toNumber(),
    creditAmount: original.debitAmount.toNumber(),
    description: params.description ?? `Reversal of ${original.id}`,
    createdBy: params.createdBy,
    tx: params.tx,
  });

  await params.tx.ledgerEntry.update({
    where: { id: original.id },
    data: { isReversal: true, reversedEntryId: reversal.id },
  });
  await params.tx.ledgerEntry.update({
    where: { id: reversal.id },
    data: { isReversal: true, reversedEntryId: original.id },
  });

  return reversal;
}

export async function updateShopOutstanding(
  shopId: string,
  tx: Tx,
) {
  const ledger = await tx.ledgerEntry.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });
  const outstanding = ledger?.runningBalance.toNumber() ?? 0;
  await tx.shop.update({
    where: { id: shopId },
    data: { currentOutstanding: new Prisma.Decimal(outstanding) },
  });
  return outstanding;
}

export async function listLedger(query: {
  page: number;
  limit: number;
  shopId?: string;
  from?: Date;
  to?: Date;
  userRole?: string;
  shopIds?: string[];
}) {
  const where: Prisma.LedgerEntryWhereInput = {};
  if (query.userRole === "SHOP_OWNER") {
    where.shopId = { in: query.shopIds ?? [] };
  } else if (query.shopId) {
    where.shopId = query.shopId;
  }
  if (query.from || query.to) {
    where.transactionDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [total, entries] = await prisma.$transaction([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: { shop: { select: { id: true, shopCode: true, shopName: true } } },
    }),
  ]);

  return { total, entries };
}

export async function getShopLedger(shopId: string) {
  return prisma.ledgerEntry.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOutstanding(shopId: string, userRole?: string, shopIds?: string[]) {
  if (userRole === "SHOP_OWNER" && !shopIds?.includes(shopId)) {
    throw new AppError("You do not have access to this shop", 403);
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  const ledger = await prisma.ledgerEntry.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  const currentOutstanding = ledger?.runningBalance.toNumber() ?? 0;
  const availableCredit = Number(shop.creditLimit) - currentOutstanding;

  return {
    shopId: shop.id,
    shopCode: shop.shopCode,
    shopName: shop.shopName,
    currentOutstanding,
    totalInvoices: (await prisma.invoice.aggregate({
      where: { shopId, status: { notIn: ["CANCELLED"] } },
      _sum: { totalAmount: true },
    }))._sum.totalAmount?.toNumber() ?? 0,
    totalPayments: (await prisma.payment.aggregate({
      where: { shopId, paymentStatus: "SUCCESS" },
      _sum: { amount: true },
    }))._sum.amount?.toNumber() ?? 0,
    creditLimit: Number(shop.creditLimit),
    availableCredit,
    creditBehavior: shop.creditBehavior,
  };
}

export async function addAdjustment(data: {
  shopId: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  description?: string;
  createdBy?: string;
}) {
  const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const entry = await createLedgerEntry({
      shopId: data.shopId,
      transactionType: "ADJUSTMENT",
      referenceType: "ADJUSTMENT",
      referenceId: `ADJ-${Date.now()}`,
      debitAmount: data.direction === "DEBIT" ? data.amount : 0,
      creditAmount: data.direction === "CREDIT" ? data.amount : 0,
      description: data.description ?? `Manual ${data.direction} adjustment`,
      createdBy: data.createdBy,
      tx,
    });
    await updateShopOutstanding(data.shopId, tx);
    return entry;
  });

  return result;
}

export async function addCreditNote(data: {
  shopId: string;
  amount: number;
  reason: string;
  invoiceId?: string;
  createdBy?: string;
}) {
  const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const entry = await createLedgerEntry({
      shopId: data.shopId,
      transactionType: "CREDIT_NOTE",
      referenceType: "CREDIT_NOTE",
      referenceId: data.invoiceId ?? `CN-${Date.now()}`,
      creditAmount: data.amount,
      description: `Credit note: ${data.reason}`,
      createdBy: data.createdBy,
      tx,
    });

    if (data.invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
      if (invoice) {
        const newPaid = Math.min(Number(invoice.paidAmount) + data.amount, Number(invoice.totalAmount));
        const newOutstanding = Number(invoice.totalAmount) - newPaid;
        const status =
          newOutstanding <= 0
            ? "PAID"
            : newPaid > 0
              ? "PARTIALLY_PAID"
              : invoice.status;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status,
          },
        });
      }
    }

    await updateShopOutstanding(data.shopId, tx);
    return entry;
  });

  return result;
}