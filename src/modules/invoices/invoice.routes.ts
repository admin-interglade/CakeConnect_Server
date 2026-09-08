import { Router } from "express";
import * as ctrl from "./invoice.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  createInvoiceSchema,
  invoiceIdParams,
  shopIdParams,
  sendInvoiceSchema,
  listInvoicesQuery,
} from "./invoice.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const invoiceRouter = Router();

invoiceRouter.use(authenticate);

invoiceRouter.get("/", validateQuery(listInvoicesQuery), ctrl.listInvoices);
invoiceRouter.get("/shops/:shopId", validateParams(shopIdParams), ctrl.getShopInvoices);
invoiceRouter.get("/:id/pdf", validateParams(invoiceIdParams), ctrl.downloadInvoicePdf);
invoiceRouter.get("/:id", validateParams(invoiceIdParams), ctrl.getInvoice);
invoiceRouter.post("/:id/issue", authorize("ADMIN"), validateParams(invoiceIdParams), ctrl.issueInvoice);
invoiceRouter.post("/:id/send", authorize("ADMIN"), validateParams(invoiceIdParams), validateBody(sendInvoiceSchema), ctrl.sendInvoice);

invoiceRouter.use(authorize("ADMIN"));
invoiceRouter.post("/", validateBody(createInvoiceSchema), ctrl.createInvoice);