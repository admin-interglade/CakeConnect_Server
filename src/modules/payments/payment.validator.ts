import { z } from "zod";

export const createPaymentSchema = z.object({
  shopId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["UPI", "CARD", "NET_BANKING", "CASH", "CHEQUE", "NEFT"]),
  paymentDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const webhookSchema = z.object({
  event: z.string(),
  transactionId: z.string(),
  paymentReference: z.string().optional(),
  amount: z.coerce.number().optional(),
  status: z.enum(["SUCCESS", "FAILED", "PENDING_CONFIRMATION"]),
  signature: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const paymentIdParams = z.object({
  id: z.string().uuid(),
});

export const confirmPaymentSchema = z.object({
  notes: z.string().optional(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(1),
});

export const listPaymentsQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "PENDING_CONFIRMATION", "REJECTED", "REFUNDED"]).optional(),
  shopId: z.string().uuid().optional(),
  paymentMethod: z.enum(["UPI", "CARD", "NET_BANKING", "CASH", "CHEQUE", "NEFT"]).optional(),
});