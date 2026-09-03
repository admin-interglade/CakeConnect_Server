import { z } from "zod";

export const notificationIdParams = z.object({
  id: z.string().uuid(),
});

export const updatePreferenceSchema = z.object({
  type: z.enum([
    "CUT_OFF_REMINDER",
    "ORDER_SUBMITTED",
    "ORDER_ACCEPTED",
    "ORDER_IN_PRODUCTION",
    "ORDER_DISPATCHED",
    "ORDER_DELIVERED",
    "INVOICE_GENERATED",
    "PAYMENT_SUCCESS",
    "PAYMENT_FAILED",
    "PAYMENT_OVERDUE",
    "NEW_OFFER",
    "CREDIT_LIMIT_WARNING",
  ]),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
});

export const listNotificationsQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  type: z.string().optional(),
  unreadOnly: z.boolean().optional(),
});