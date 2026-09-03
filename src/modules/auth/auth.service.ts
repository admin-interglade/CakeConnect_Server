import crypto from "node:crypto";
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

  const bcrypt = await import("bcryptjs");
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
