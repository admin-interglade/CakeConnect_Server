import { z } from "zod";

export const createShopSchema = z.object({
  shopCode: z.string().min(2).max(20),
  shopName: z.string().min(1),
  ownerMobileNumber: z.string().regex(/^[0-9]{10}$/).optional(),
  ownerName: z.string().optional(),
  mobileNumber: z.string().regex(/^[0-9]{10}$/),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gstin: z.string().optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
  priceListId: z.string().uuid().optional(),
});

export const updateShopSchema = z
  .object({
    shopName: z.string().min(1).optional(),
    mobileNumber: z.string().regex(/^[0-9]{10}$/).optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    gstin: z.string().optional(),
  })
  .strict();

export const shopStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]),
});

export const assignOwnerSchema = z.object({
  userId: z.string().uuid(),
});

export const creditLimitSchema = z.object({
  creditLimit: z.coerce.number().nonnegative(),
  creditBehavior: z.enum(["WARN", "BLOCK_ORDER"]).optional(),
});

export const assignPriceListSchema = z.object({
  priceListId: z.string().uuid(),
});

export const shopIdParams = z.object({
  id: z.string().uuid(),
});

export const listShopsQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).optional(),
  search: z.string().optional(),
  city: z.string().optional(),
});