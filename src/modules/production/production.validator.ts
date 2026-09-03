import { z } from "zod";

export const generatePlanSchema = z.object({
  productionDate: z.coerce.date(),
});

export const productionDateParams = z.object({
  date: z.coerce.date(),
});

export const planIdParams = z.object({
  id: z.string().uuid(),
});

export const updatePlanSchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "IN_PRODUCTION", "COMPLETED"]).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        itemId: z.string().uuid().optional(),
        requiredQuantity: z.coerce.number().int().nonnegative().optional(),
        producedQuantity: z.coerce.number().int().nonnegative().optional(),
      }),
    )
    .optional(),
});