import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  apiPrefix: process.env.API_PREFIX || "/api/v1",

  databaseUrl: process.env.DATABASE_URL || "",

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "refresh-secret",
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",

  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 5,
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,

  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT) || 6379,
  redisPassword: process.env.REDIS_PASSWORD || undefined,

  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || "",

  paymentGatewayKey: process.env.PAYMENT_GATEWAY_KEY || "",
  paymentGatewaySecret: process.env.PAYMENT_GATEWAY_SECRET || "",
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || "",

  creditLimitBehavior: process.env.CREDIT_LIMIT_BEHAVIOR || "WARN",
  globalCutoffTime: process.env.GLOBAL_CUTOFF_TIME || "22:00",

  corsOrigin: process.env.CORS_ORIGIN || "*",

  uploadsDir: process.env.UPLOADS_DIR || path.join(projectRoot, "uploads"),
};
