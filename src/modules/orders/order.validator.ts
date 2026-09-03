import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  shopId: z.string().uuid(),
  deliveryDate: z.coerce.date(),
  notes: z.string().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export const updateOrderSchema = z.object({
  notes: z.string().optional(),
  deliveryDate: z.coerce.date().optional(),
  items: z.array(orderItemInputSchema).min(1).optional(),
});

export const orderIdParams = z.object({
  id: z.string().uuid(),
});

export const listOrdersQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "ACCEPTED",
      "IN_PRODUCTION",
      "DISPATCHED",
      "DELIVERED",
      "INVOICED",
      "CANCELLED",
      "NO_ORDER_PLACED",
    ])
    .optional(),
  shopId: z.string().uuid().optional(),
  deliveryDate: z.coerce.date().optional(),
  search: z.string().optional(),
});

export const statusTransitionSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "IN_PRODUCTION",
    "DISPATCHED",
    "DELIVERED",
    "INVOICED",
  ]),
});

export const repeatSchema = z.object({
  shopId: z.string().uuid(),
  deliveryDate: z.coerce.date(),
  sourceOrderId: z.string().uuid().optional(),
});