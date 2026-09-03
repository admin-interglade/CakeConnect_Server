import { z } from "zod";

export const reportsQuery = z.object({
  from: z.coerce.date(),
  to: z.coerce.date().default(() => new Date()),
  shopId: z.string().uuid().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

export const listReportsQuery = z.object({
  type: z.enum(["sales", "outstanding", "collections", "cutoff-compliance", "orders", "payments"]),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  shopId: z.string().uuid().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});