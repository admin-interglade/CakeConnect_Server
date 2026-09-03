import { z } from "zod";

export const createDeliverySchema = z.object({
  orderId: z.string().uuid(),
  deliveryDate: z.coerce.date(),
  notes: z.string().optional(),
});

export const deliveryIdParams = z.object({
  id: z.string().uuid(),
});

export const markDispatchedSchema = z.object({
  notes: z.string().optional(),
});

export const markDeliveredSchema = z.object({
  receivedBy: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        deliveredQuantity: z.coerce.number().int().nonnegative(),
        shortSupplyReason: z.string().optional(),
      }),
    )
    .min(1),
});

export const listDeliveriesQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(["PENDING", "IN_TRANSIT", "DELIVERED", "PARTIALLY_DELIVERED", "FAILED"]).optional(),
  deliveryDate: z.coerce.date().optional(),
});