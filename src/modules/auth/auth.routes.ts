import { Router } from "express";
import * as ctrl from "./auth.controller.js";
import { validateBody } from "../../common/middleware/validate.js";
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  logoutSchema,
} from "./auth.validator.js";
import { authenticate } from "../../common/middleware/auth.js";
import { otpRateLimiter } from "../../common/middleware/rateLimiter.js";

export const authRouter = Router();

authRouter.post("/send-otp", otpRateLimiter, validateBody(sendOtpSchema), ctrl.sendOtp);
authRouter.post("/verify-otp", otpRateLimiter, validateBody(verifyOtpSchema), ctrl.verifyOtp);
authRouter.post("/refresh-token", validateBody(refreshTokenSchema), ctrl.refreshToken);
authRouter.post("/logout", validateBody(logoutSchema), ctrl.logout);
authRouter.get("/me", authenticate, ctrl.me);
