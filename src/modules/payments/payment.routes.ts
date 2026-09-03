import { Router } from "express";
import * as ctrl from "./payment.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  createPaymentSchema,
  webhookSchema,
  paymentIdParams,
  confirmPaymentSchema,
  rejectPaymentSchema,
  listPaymentsQuery,
} from "./payment.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const paymentRouter = Router();

paymentRouter.post("/webhook", validateBody(webhookSchema), ctrl.webhook);

paymentRouter.use(authenticate);

paymentRouter.get("/", validateQuery(listPaymentsQuery), ctrl.listPayments);
paymentRouter.post("/create", validateBody(createPaymentSchema), ctrl.createPayment);
paymentRouter.get("/:id", validateParams(paymentIdParams), ctrl.getPayment);

paymentRouter.use(authorize("ADMIN"));
paymentRouter.post("/:id/confirm", validateParams(paymentIdParams), validateBody(confirmPaymentSchema), ctrl.confirmPayment);
paymentRouter.post("/:id/reject", validateParams(paymentIdParams), validateBody(rejectPaymentSchema), ctrl.rejectPayment);