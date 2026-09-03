import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  unit: z.string().default("piece"),
  basePrice: z.coerce.number().nonnegative(),
  minimumOrderQuantity: z.coerce.number().int().nonnegative().default(1),
  packSize: z.coerce.number().int().positive().default(1),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  unit: z.string().optional(),
  basePrice: z.coerce.number().nonnegative().optional(),
  minimumOrderQuantity: z.coerce.number().int().nonnegative().optional(),
  packSize: z.coerce.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "UNAVAILABLE"]).optional(),
  categoryId: z.string().uuid().optional(),
});

export const productIdParams = z.object({
  id: z.string().uuid(),
});

export const listProductsQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "UNAVAILABLE"]).optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const setAvailabilitySchema = z.object({
  date: z.coerce.date(),
  available: z.boolean(),
  note: z.string().optional(),
});

export const clearAvailabilitySchema = z.object({
  date: z.coerce.date(),
});