import { z } from "zod";

export const createOfferSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  bannerUrl: z.string().url().optional(),
  discountType: z.enum(["PERCENTAGE", "FLAT", "BUY_X_GET_Y"]),
  discountValue: z.coerce.number().nonnegative(),
  buyQuantity: z.coerce.number().int().positive().optional(),
  getQuantity: z.coerce.number().int().positive().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "SCHEDULED", "EXPIRED", "WITHDRAWN"]).optional(),
  targetAllShops: z.boolean().default(true),
  productIds: z.array(z.string().uuid()).optional(),
  shopIds: z.array(z.string().uuid()).optional(),
  regions: z.array(z.string()).optional(),
});

export const updateOfferSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  discountType: z.enum(["PERCENTAGE", "FLAT", "BUY_X_GET_Y"]).optional(),
  discountValue: z.coerce.number().nonnegative().optional(),
  buyQuantity: z.coerce.number().int().positive().optional(),
  getQuantity: z.coerce.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "SCHEDULED", "EXPIRED", "WITHDRAWN"]).optional(),
});

export const offerIdParams = z.object({
  id: z.string().uuid(),
});

export const withdrawOfferSchema = z.object({
  reason: z.string().optional(),
});

export const listOffersQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(["ACTIVE", "SCHEDULED", "EXPIRED", "WITHDRAWN"]).optional(),
});