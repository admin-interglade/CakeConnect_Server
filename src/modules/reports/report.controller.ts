import type { Request, Response } from "express";
import * as reportService from "./report.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success } from "../../common/response.js";

export const sales = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportService.salesReport({
    from: new Date(req.query.from as string),
    to: new Date(req.query.to as string),
    shopId: req.query.shopId as string | undefined,
    userRole: req.user!.role,
    shopIds: req.user!.shopIds ?? [],
  });
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.csv");
    return res.send(data.csv);
  }
  return success(res, data, "Sales report fetched");
});

export const outstanding = asyncHandler(async (_req: Request, res: Response) => {
  const data = await reportService.outstandingReport({
    userRole: _req.user!.role,
    shopIds: _req.user!.shopIds ?? [],
  });
  if (_req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=outstanding-report.csv");
    return res.send(data.csv);
  }
  return success(res, data, "Outstanding report fetched");
});

export const collections = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportService.collectionsReport({
    from: new Date(req.query.from as string),
    to: new Date(req.query.to as string),
    userRole: req.user!.role,
    shopIds: req.user!.shopIds ?? [],
  });
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=collections-report.csv");
    return res.send(data.csv);
  }
  return success(res, data, "Collections report fetched");
});

export const cutoffCompliance = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportService.cutoffComplianceReport({
    from: new Date(req.query.from as string),
    to: new Date(req.query.to as string),
  });
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=cutoff-compliance-report.csv");
    return res.send(data.csv);
  }
  return success(res, data, "Cut-off compliance report fetched");
});