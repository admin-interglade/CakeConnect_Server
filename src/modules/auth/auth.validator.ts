import { z } from "zod";

export const sendOtpSchema = z.object({
  mobileNumber: z
    .string()
    .regex(/^[0-9]{10}$/, "Mobile number must be 10 digits"),
});

export const verifyOtpSchema = z.object({
  mobileNumber: z
    .string()
    .regex(/^[0-9]{10}$/, "Mobile number must be 10 digits"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  name: z.string().optional(),
  deviceId: z.string().optional(),
  fcmToken: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
