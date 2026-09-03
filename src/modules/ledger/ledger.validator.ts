import { z } from "zod";

export const listLedgerQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  shopId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const shopIdParams = z.object({
  shopId: z.string().uuid(),
});

export const adjustmentSchema = z.object({
  shopId: z.string().uuid(),
  amount: z.coerce.number(),
  type: z.enum(["ADJUSTMENT"]),
  direction: z.enum(["DEBIT", "CREDIT"]),
  description: z.string().optional(),
});

export const creditNoteSchema = z.object({
  shopId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reason: z.string().min(1),
  invoiceId: z.string().uuid().optional(),
});