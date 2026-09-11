import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1),
  mobileNumber: z.string().regex(/^[0-9]{10}$/, "Mobile number must be 10 digits"),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "SHOP_OWNER", "SUPPORT_STAFF"]).optional(),
  password: z.string().min(6).optional(),
});

export const createOwnerSchema = z.object({
  name: z.string().min(1),
  mobileNumber: z.string().regex(/^[0-9]{10}$/),
  email: z.string().email(),
  shopIds: z.array(z.string().uuid()).min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  profileImage: z.string().url().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "SHOP_OWNER", "SUPPORT_STAFF"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).optional(),
});

export const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]),
});

export const userIdParams = z.object({
  id: z.string().uuid(),
});
