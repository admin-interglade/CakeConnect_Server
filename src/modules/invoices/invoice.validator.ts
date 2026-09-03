import { z } from "zod";

export const createInvoiceSchema = z.object({
  shopId: z.string().uuid(),
  orderId: z.string().uuid(),
  dueDate: z.coerce.date(),
  basedOnDelivered: z.boolean().default(true),
  notes: z.string().optional(),
});

export const invoiceIdParams = z.object({
  id: z.string().uuid(),
});

export const shopIdParams = z.object({
  shopId: z.string().uuid(),
});

export const sendInvoiceSchema = z.object({
  email: z.string().email(),
});

export const listInvoicesQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  shopId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});