import { z } from "zod";

export const createPriceListSchema = z.object({
  name: z.string().min(1),
  region: z.string().optional(),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        price: z.coerce.number().nonnegative(),
      }),
    )
    .optional(),
});

export const updatePriceListSchema = z.object({
  name: z.string().min(1).optional(),
  region: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const addItemSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        price: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
});

export const removeItemSchema = z.object({
  productId: z.string().uuid(),
});

export const priceListIdParams = z.object({
  id: z.string().uuid(),
});

export const itemIdParams = z.object({
  itemId: z.string().uuid(),
});