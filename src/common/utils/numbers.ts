import { prisma } from "../../prisma/index.js";

export async function generateOrderNumber(): Promise<string> {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;

  const count = await prisma.order.count({
    where: { orderNumber: { contains: `ORD-${datePart}` } },
  });

  return `ORD-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;

  const count = await prisma.invoice.count({
    where: { invoiceNumber: { contains: `INV-${datePart}` } },
  });

  return `INV-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

export async function generatePaymentReference(): Promise<string> {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PAY-${timestamp}${random}`;
}