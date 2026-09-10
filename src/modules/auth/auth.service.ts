import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../prisma/index.js";
import { config } from "../../config/index.js";
import type { Role, User } from "@prisma/client";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../common/utils/jwt.js";
import {
  AppError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "../../common/AppError.js";

function generateOTP(): string {
  const raw = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  return raw;
}

function isOTPExpired(createdAt: Date): boolean {
  const expiresAt = new Date(
    createdAt.getTime() + config.otpExpiryMinutes * 60 * 1000,
  );
  return new Date() > expiresAt;
}

function isWithinCooldown(createdAt: Date): boolean {
  const cooldownAt = new Date(
    createdAt.getTime() + config.otpResendCooldownSeconds * 1000,
  );
  return new Date() < cooldownAt;
}

export async function sendOTP(mobileNumber: string) {
  const lastOtp = await prisma.oTP.findFirst({
    where: { mobileNumber },
    orderBy: { createdAt: "desc" },
  });

  if (lastOtp && isWithinCooldown(lastOtp.createdAt)) {
    throw new AppError("Please wait before requesting a new OTP", 429);
  }

  const otp = process.env.NODE_ENV === "development" ? "123456" : generateOTP();
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  await prisma.oTP.create({
    data: { mobileNumber, otp, expiresAt },
  });

  // TODO: Integrate SMS provider here.
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[DEV] OTP for ${mobileNumber}: ${otp}`);
  }

  return { message: "OTP sent successfully", expiresAt };
}

export async function verifyOTP(data: {
  mobileNumber: string;
  otp: string;
  name?: string;
  deviceId?: string;
  fcmToken?: string;
}) {
  const otpRecord = await prisma.oTP.findFirst({
    where: { mobileNumber: data.mobileNumber, verified: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new AppError("No OTP found. Please request a new OTP", 400);
  }

  if (isOTPExpired(otpRecord.createdAt)) {
    throw new AppError("OTP has expired. Please request a new OTP", 400);
  }

  if (otpRecord.otp !== data.otp) {
    throw new AppError("Invalid OTP", 400);
  }

  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { verified: true },
  });

  let user = await prisma.user.findUnique({
    where: { mobileNumber: data.mobileNumber },
  });

  if (!user) {
    const role: Role = "SHOP_OWNER";
    user = await prisma.user.create({
      data: {
        mobileNumber: data.mobileNumber,
        name: data.name || "Shop Owner",
        role,
      },
    });
  }

  if (user.status === "SUSPENDED") {
    throw new AppError("Account is suspended. Contact support.", 403);
  }

  const { accessToken, refreshToken, expiresAt } = await createSession(
    user,
    data.deviceId,
    data.fcmToken,
  );

  return { user: sanitizeUser(user), accessToken, refreshToken, expiresAt };
}

export async function loginById(data: {
  mobileNumber: string;
  password: string;
  deviceId?: string;
  fcmToken?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { mobileNumber: data.mobileNumber },
  });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError("Invalid mobile number or password");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("Account is not active. Contact support.", 403);
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid mobile number or password");
  }

  const { accessToken, refreshToken, expiresAt } = await createSession(
    user,
    data.deviceId,
    data.fcmToken,
  );

  return { user: sanitizeUser(user), accessToken, refreshToken, expiresAt };
}

/**
 * Sets a new password, and is the same endpoint for both situations that need
 * it:
 *   - the very first login with the emailed one-time password, when
 *     `mustChangePassword` is set and the app shows "add password + confirm"
 *     before entering the app; and
 *   - a voluntary change, when the caller must prove the current password.
 */
export async function changePassword(data: {
  userId: string;
  currentPassword?: string;
  newPassword: string;
}) {
  if (data.newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (!user.mustChangePassword) {
    if (!data.currentPassword || !user.passwordHash) {
      throw new UnauthorizedError("Current password is required");
    }
    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Current password is incorrect");
    }
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return { message: "Password updated successfully" };
}

async function createSession(
  user: User,
  deviceId?: string,
  fcmToken?: string,
) {
  const refreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(
    Date.now() + parseDurationMs(config.jwtRefreshExpires),
  );

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      deviceId,
      fcmToken,
      expiresAt,
    },
  });

  const accessToken = signAccessToken(user.id, user.role);
  return { accessToken, refreshToken, expiresAt };
}

function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    mobileNumber: user.mobileNumber,
    email: user.email,
    role: user.role,
    status: user.status,
    profileImage: user.profileImage,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function refreshTokens(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const session = await prisma.session.findUnique({
    where: { refreshToken },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new UnauthorizedError("User not found or inactive");
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const { accessToken, refreshToken: newRefreshToken, expiresAt } =
    await createSession(
      user,
      session.deviceId ?? undefined,
      session.fcmToken ?? undefined,
    );

  return { accessToken, refreshToken: newRefreshToken, expiresAt };
}

export async function logout(refreshToken: string) {
  const session = await prisma.session.findUnique({
    where: { refreshToken },
  });
  if (session && !session.revokedAt) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }
  return { message: "Logged out successfully" };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      shopUsers: {
        include: { shop: true },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return sanitizeUser({ ...user, role: user.role } as User);
}

export async function createAdminUser(data: {
  name: string;
  mobileNumber: string;
  email?: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { mobileNumber: data.mobileNumber },
  });
  if (existing) {
    throw new ConflictError("User with this mobile number already exists");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      mobileNumber: data.mobileNumber,
      email: data.email,
      role: "ADMIN",
      passwordHash,
    },
  });

  return sanitizeUser(user);
}
