import type { Request, Response } from "express";
import * as paymentService from "./payment.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.createPayment({
    shopId: req.body.shopId,
    invoiceId: req.body.invoiceId,
    amount: req.body.amount,
    paymentMethod: req.body.paymentMethod,
    paymentDate: req.body.paymentDate,
    notes: req.body.notes,
    idempotencyKey: req.body.idempotencyKey ?? req.body.transactionId,
  });
  return success(res, result, "Payment created", 201);
});

export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.handleWebhook(req.body);
  return success(res, result, "Webhook processed");
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, payments } = await paymentService.listPayments({
    page,
    limit,
    status: req.query.status as string | undefined,
    shopId: req.query.shopId as string | undefined,
    paymentMethod: req.query.paymentMethod as string | undefined,
    userRole: req.user?.role,
    shopIds: req.user?.shopIds,
  });
  return paginate(res, payments, total, page, limit, "Payments fetched");
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.getPaymentById(
    req.params.id,
    req.user?.role,
    req.user?.shopIds,
  );
  return success(res, payment, "Payment fetched");
});

export const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.confirmPayment(
    req.params.id,
    req.user?.userId,
  );
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "PAYMENT_CONFIRMED",
      entityType: "Payment",
      entityId: req.params.id,
      newValue: { status: "SUCCESS" },
    },
    req,
  );
  return success(res, payment, "Payment confirmed");
});

export const rejectPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.rejectPayment(
    req.params.id,
    req.body.reason,
    req.user?.userId,
  );
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "PAYMENT_REJECTED",
      entityType: "Payment",
      entityId: req.params.id,
      newValue: { status: "REJECTED", reason: req.body.reason },
    },
    req,
  );
  return success(res, payment, "Payment rejected");
});