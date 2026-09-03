import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success } from "../../common/response.js";

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { mobileNumber } = req.body;
  const result = await authService.sendOTP(mobileNumber);
  return success(res, result, "OTP sent successfully");
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyOTP(req.body);
  return success(res, result, "Login successful");
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginById(req.body);
  return success(res, result, "Admin login successful");
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshTokens(refreshToken);
  return success(res, result, "Tokens refreshed");
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.logout(refreshToken);
  return success(res, result, "Logged out successfully");
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.getMe(req.user!.userId);
  return success(res, result, "Profile fetched");
});
