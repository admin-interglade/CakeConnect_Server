import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { sendCredentialEmail } from "./mailer.js";

// No look-alike characters (01OIl) so a password read out over the phone or
// typed from a mail client does not trip on fonts.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Emails a one-time password for a freshly provisioned owner account along with
 * the quickest sign-in facts (mobile number, shop). Returns the temporary
 * password so the caller can also persist its hash. Used by every entry point
 * that mints an owner account — `POST /users` (owner profile) and `POST /shops`
 * (implicit owner when the admin types a number we have not seen).
 */
export async function issueOwnerCredentials(params: {
  email: string;
  mobileNumber: string;
  shopName?: string;
  shopCode?: string;
}): Promise<string> {
  const tempPassword = generateTempPassword();
  await sendCredentialEmail({
    to: params.email,
    mobileNumber: params.mobileNumber,
    tempPassword,
    shopName: params.shopName,
    shopCode: params.shopCode,
  });
  return tempPassword;
}