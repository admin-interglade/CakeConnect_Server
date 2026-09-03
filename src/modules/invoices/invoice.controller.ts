import type { Request, Response } from "express";
import * as invoiceService from "./invoice.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const result = await invoiceService.createInvoice({
    shopId: req.body.shopId,
    orderId: req.body.orderId,
    dueDate: req.body.dueDate,
    basedOnDelivered: req.body.basedOnDelivered,
    createdBy: req.user?.userId,
  });
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: result.invoice.id,
      newValue: result.invoice,
    },
    req,
  );
  return success(res, result, "Invoice created", 201);
});

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, invoices } = await invoiceService.listInvoices({
    page,
    limit,
    status: req.query.status as string | undefined,
    shopId: req.query.shopId as string | undefined,
    from: req.query.from ? new Date(req.query.from as string) : undefined,
    to: req.query.to ? new Date(req.query.to as string) : undefined,
    userRole: req.user?.role,
    shopIds: req.user?.shopIds,
  });
  return paginate(res, invoices, total, page, limit, "Invoices fetched");
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getInvoiceById(
    req.params.id,
    req.user?.role,
    req.user?.shopIds,
  );
  return success(res, invoice, "Invoice fetched");
});

export const getShopInvoices = asyncHandler(async (req: Request, res: Response) => {
  const invoices = await invoiceService.getShopInvoices(req.params.shopId);
  return success(res, invoices, "Shop invoices fetched");
});

export const issueInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.issueInvoice(req.params.id);
  return success(res, invoice, "Invoice issued");
});

export const sendInvoice = asyncHandler(async (req: Request, res: Response) => {
  const result = await invoiceService.sendInvoice(req.params.id, req.body.email);
  return success(res, result, "Invoice sent");
});