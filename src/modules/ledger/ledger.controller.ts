import type { Request, Response } from "express";
import * as ledgerService from "./ledger.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const listLedger = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, entries } = await ledgerService.listLedger({
    page,
    limit,
    shopId: req.query.shopId as string | undefined,
    from: req.query.from ? new Date(req.query.from as string) : undefined,
    to: req.query.to ? new Date(req.query.to as string) : undefined,
    userRole: req.user?.role,
    shopIds: req.user?.shopIds,
  });
  return paginate(res, entries, total, page, limit, "Ledger entries fetched");
});

export const getShopLedger = asyncHandler(async (req: Request, res: Response) => {
  const entries = await ledgerService.getShopLedger(req.params.shopId);
  return success(res, entries, "Shop ledger fetched");
});

export const getOutstanding = asyncHandler(async (req: Request, res: Response) => {
  const outstanding = await ledgerService.getOutstanding(
    req.params.shopId,
    req.user?.role,
    req.user?.shopIds,
  );
  return success(res, outstanding, "Outstanding fetched");
});

export const addAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const entry = await ledgerService.addAdjustment({
    shopId: req.body.shopId,
    amount: req.body.amount,
    direction: req.body.direction,
    description: req.body.description,
    createdBy: req.user?.userId,
  });
  await logAudit(
    {
      actorId: req.user!.userId,
      action: `LEDGER_ADJUSTMENT_${req.body.direction}`,
      entityType: "LedgerEntry",
      entityId: entry.id,
      newValue: entry,
    },
    req,
  );
  return success(res, entry, "Adjustment added");
});

export const addCreditNote = asyncHandler(async (req: Request, res: Response) => {
  const entry = await ledgerService.addCreditNote({
    shopId: req.body.shopId,
    amount: req.body.amount,
    reason: req.body.reason,
    invoiceId: req.body.invoiceId,
    createdBy: req.user?.userId,
  });
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "CREDIT_NOTE_ADDED",
      entityType: "LedgerEntry",
      entityId: entry.id,
      newValue: entry,
    },
    req,
  );
  return success(res, entry, "Credit note added");
});