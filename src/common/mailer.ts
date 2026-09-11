import nodemailer from "nodemailer";
import { config } from "../config/index.js";

type Transporter = ReturnType<typeof nodemailer.createTransport>;

const isConfigured = Boolean(
  config.mail.smtpHost && config.mail.smtpUser && config.mail.smtpPass,
);

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isConfigured) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.smtpHost,
      port: config.mail.smtpPort,
      secure: config.mail.smtpPort === 465,
      // Callers await the send before answering the admin's request. Without
      // bounds, nodemailer's defaults (2 min to connect, 10 min idle) let a
      // stalled SMTP server outlast the app's timeout, so the admin is told the
      // write failed after it succeeded. Failing fast reports `inviteError`.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: {
        user: config.mail.smtpUser,
        pass: config.mail.smtpPass,
      },
    });
  }
  return transporter;
}

export async function sendCredentialEmail(params: {
  to: string;
  mobileNumber: string;
  tempPassword: string;
  shopName?: string;
  shopCode?: string;
}): Promise<boolean> {
  const shopLine = params.shopName
    ? `Your shop: ${params.shopName}${params.shopCode ? ` (${params.shopCode})` : ""}\n`
    : "";
  const subject = params.shopName
    ? `Your ${params.shopName} login credentials`
    : `Your CakeConnect login credentials`;
  const body = `Welcome to CakeConnect!\n\n` +
    shopLine +
    `Mobile number: ${params.mobileNumber}\n` +
    `Temporary password: ${params.tempPassword}\n\n` +
    `Sign in with your mobile number and this temporary password. On your first ` +
    `login you will be asked to set your own password.\n\n` +
    `— CakeConnect`;

  const t = getTransporter();

  if (!t) {
    // No SMTP configured: dev fallback — print the credentials so the flow can
    // be exercised end to end. Never throw: a shop was already created and the
    // admin must not see a 500 because mail is not wired up yet.
    // eslint-disable-next-line no-console
    console.log("--------------------------------------------------");
    // eslint-disable-next-line no-console
    console.log(`[MAIL][dev] Credentials for ${params.to}`);
    // eslint-disable-next-line no-console
    console.log(body);
    // eslint-disable-next-line no-console
    console.log("--------------------------------------------------");
    return false;
  }

  await t.sendMail({
    from: config.mail.fromEmail || config.mail.smtpUser,
    to: params.to,
    subject,
    text: body,
  });
  return true;
}

export async function sendShopAssignmentEmail(params: {
  to: string;
  ownerName: string;
  shopName: string;
  shopCode: string;
}): Promise<boolean> {
  const subject = `Shop assigned to your CakeConnect account`;
  const body = `Hello ${params.ownerName},\n\n` +
    `The shop ${params.shopName} (${params.shopCode}) has been assigned to your CakeConnect account.\n` +
    `Sign in with your registered mobile number or existing password.\n\n` +
    `- CakeConnect`;

  const t = getTransporter();
  if (!t) {
    console.log(`[MAIL][dev] Shop assignment for ${params.to}\n${body}`);
    return false;
  }

  await t.sendMail({
    from: config.mail.fromEmail || config.mail.smtpUser,
    to: params.to,
    subject,
    text: body,
  });
  return true;
}