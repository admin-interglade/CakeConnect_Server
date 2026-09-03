import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  leadTimeHours: z.coerce.number().nonnegative().optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal("")),
    leadTimeHours: z.coerce.number().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const categoryIdParams = z.object({
  id: z.string().uuid(),
});