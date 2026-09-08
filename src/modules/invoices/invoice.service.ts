import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError, AppError } from "../../common/AppError.js";
import { generateInvoiceNumber } from "../../common/utils/numbers.js";
import { createLedgerEntry, updateShopOutstanding } from "../ledger/ledger.service.js";
import { generateInvoicePdf, type InvoicePdfData } from "./pdf.service.js";
import { createNotification } from "../notifications/notification.service.js";

const TAX_RATE = 0.0;

export async function generatePdfForInvoice(invoiceId: string): Promise<string> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      shop: true,
      order: true,
      items: true,
    },
  });
  if (!invoice) {
    throw new NotFoundError("Invoice not found");
  }

  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    subtotal: invoice.subtotal.toNumber(),
    taxAmount: invoice.taxAmount.toNumber(),
    discountAmount: invoice.discountAmount.toNumber(),
    totalAmount: invoice.totalAmount.toNumber(),
    shop: {
      shopName: invoice.shop.shopName,
      shopCode: invoice.shop.shopCode,
      address: invoice.shop.address,
      city: invoice.shop.city,
      state: invoice.shop.state,
      pincode: invoice.shop.pincode,
      gstin: invoice.shop.gstin,
    },
    orderNumber: invoice.order?.orderNumber ?? null,
    items: invoice.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      tax: item.tax.toNumber(),
      discount: item.discount.toNumber(),
      totalAmount: item.totalAmount.toNumber(),
    })),
  };

  const filePath = await generateInvoicePdf(data);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { invoicePdfPath: filePath },
  });

  return filePath;
}

export async function createInvoice(data: {
  shopId: string;
  orderId: string;
  dueDate: Date;
  basedOnDelivered?: boolean;
  notes?: string;
  createdBy?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { items: true, delivery: { include: { items: true } }, shop: true },
  });
  if (!order) {
    throw new NotFoundError("Order not found");
  }
  if (order.shopId !== data.shopId) {
    throw new AppError("Order does not belong to this shop", 400);
  }

  const existingInvoice = await prisma.invoice.findUnique({
    where: { orderId: data.orderId },
  });
  if (existingInvoice) {
    throw new ConflictError("Invoice already exists for this order");
  }

  const basedOnDelivered = data.basedOnDelivered ?? true;

  let items;
  if (basedOnDelivered && order.delivery) {
    items = order.delivery.items.map((dItem) => {
      const orderItem = order.items.find((i) => i.productId === dItem.productId);
      const unitPrice = orderItem ? Number(orderItem.unitPrice) : 0;
      const qty = dItem.deliveredQuantity;
      const subtotal = unitPrice * qty;
      const tax = subtotal * TAX_RATE;
      return {
        productId: dItem.productId,
        productName: orderItem?.productName ?? "",
        quantity: qty,
        unitPrice,
        tax,
        discount: 0,
        totalAmount: subtotal + tax,
      };
    });
  } else {
    items = order.items.map((item) => {
      const subtotal = Number(item.unitPrice) * item.quantity;
      const tax = subtotal * TAX_RATE;
      return {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        tax,
        discount: Number(item.discount),
        totalAmount: subtotal + tax - Number(item.discount),
      };
    });
  }

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxAmount = items.reduce((s, i) => s + i.tax, 0);
  const discountAmount = items.reduce((s, i) => s + i.discount, 0);
  const totalAmount = subtotal + taxAmount - discountAmount;
  const invoiceNumber = await generateInvoiceNumber();

  const result = await prisma.$transaction(
    async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          shopId: data.shopId,
          orderId: order.id,
          dueDate: data.dueDate,
          subtotal: new Prisma.Decimal(subtotal),
          taxAmount: new Prisma.Decimal(taxAmount),
          discountAmount: new Prisma.Decimal(discountAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          outstandingAmount: new Prisma.Decimal(totalAmount),
          status: "DRAFT",
          basedOnDelivered,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              tax: new Prisma.Decimal(item.tax),
              discount: new Prisma.Decimal(item.discount),
              totalAmount: new Prisma.Decimal(item.totalAmount),
            })),
          },
        },
        include: { items: true, shop: true, order: true },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "INVOICED" },
      });

      const ledgerEntry = await createLedgerEntry({
        shopId: data.shopId,
        transactionType: "INVOICE",
        referenceType: "INVOICE",
        referenceId: invoice.id,
        debitAmount: totalAmount,
        description: `Invoice ${invoice.invoiceNumber}`,
        createdBy: data.createdBy,
        tx,
      });
      await updateShopOutstanding(data.shopId, tx);

      return { invoice, ledgerEntry };
    },
    { timeout: 15000 },
  );

  await generatePdfForInvoice(result.invoice.id);

  const withPdf = await prisma.invoice.findUnique({
    where: { id: result.invoice.id },
    include: { items: true, shop: true, order: true },
  });

  const shop = withPdf?.shop ?? order.shop;
  if (shop?.id) {
    const shopUsers = await prisma.shopUser.findMany({
      where: { shopId: shop.id },
      select: { userId: true },
    });
    const ownerIds = new Set<string>([...shopUsers.map((u) => u.userId)]);
    if (shop.ownerId) ownerIds.add(shop.ownerId);

    const invoiceNumber = result.invoice.invoiceNumber;
    const totalStr = result.invoice.totalAmount.toNumber().toLocaleString("en-IN");
    for (const userId of ownerIds) {
      await createNotification({
        userId,
        type: "INVOICE_GENERATED",
        title: "Invoice generated",
        body: `Invoice ${invoiceNumber} has been generated for ₹${totalStr}`,
        data: { invoiceId: result.invoice.id, invoiceNumber },
      });
    }
  }

  return { invoice: withPdf ?? result.invoice, ledgerEntry: result.ledgerEntry };
}

export async function listInvoices(query: {
  page: number;
  limit: number;
  status?: string;
  shopId?: string;
  from?: Date;
  to?: Date;
  userRole?: string;
  shopIds?: string[];
}) {
  const where: Record<string, unknown> = {
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.from || query.to
      ? {
          invoiceDate: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  if (query.userRole === "SHOP_OWNER") {
    where.shopId = { in: query.shopIds ?? [] };
  } else if (query.shopId) {
    where.shopId = query.shopId;
  }

  const [total, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: {
        shop: { select: { id: true, shopCode: true, shopName: true } },
        items: true,
        payments: true,
      },
    }),
  ]);

  return { total, invoices };
}

export async function getInvoiceById(id: string, userRole?: string, shopIds?: string[]) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      shop: true,
      order: true,
      items: { include: { product: true } },
      payments: true,
    },
  });
  if (!invoice) {
    throw new NotFoundError("Invoice not found");
  }
  if (userRole === "SHOP_OWNER" && !shopIds?.includes(invoice.shopId)) {
    throw new AppError("You do not have access to this invoice", 403);
  }
  return invoice;
}

export async function getShopInvoices(shopId: string) {
  return prisma.invoice.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    include: { items: true, payments: true },
  });
}

export async function issueInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    throw new NotFoundError("Invoice not found");
  }
  if (invoice.status !== "DRAFT") {
    throw new AppError("Only draft invoices can be issued", 400);
  }
  return prisma.invoice.update({
    where: { id },
    data: { status: "ISSUED" },
    include: { items: true, shop: true },
  });
}

export async function sendInvoice(id: string, email: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, shop: true },
  });
  if (!invoice) {
    throw new NotFoundError("Invoice not found");
  }
  // TODO: Integrate email provider. Email the invoice to the shop.
  return { message: `Invoice emailed to ${email}`, invoiceId: invoice.id };
}

export async function getShopNetworkOutstanding() {
  const shops = await prisma.shop.findMany({
    select: {
      id: true,
      shopCode: true,
      shopName: true,
      currentOutstanding: true,
      creditLimit: true,
    },
  });
  const networkOutstanding = shops.reduce(
    (sum, s) => sum + Number(s.currentOutstanding),
    0,
  );
  return { shops, networkOutstanding };
}