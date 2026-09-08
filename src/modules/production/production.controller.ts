import type { Request, Response } from "express";
import * as productionService from "./production.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, plans } = await productionService.listPlans({ page, limit });
  return paginate(res, plans, total, page, limit, "Production plans fetched");
});

export const getPlanByDate = asyncHandler(async (req: Request, res: Response) => {
  const plan = await productionService.getPlanByDate(new Date(req.params.date));
  return success(res, plan, "Production plan fetched");
});

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await productionService.getPlanById(req.params.id);
  return success(res, plan, "Production plan fetched");
});

export const generatePlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await productionService.generatePlan(req.body.productionDate);
  return success(res, plan, "Production plan generated", 201);
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await productionService.updatePlan(req.params.id, req.body);
  return success(res, plan, "Production plan updated");
});

export const exportPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await productionService.getPlanByDate(new Date(req.params.date));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=production-plan-${req.params.date}.csv`,
  );
  // The kitchen works from product names and units, not uuids.
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = "productName,unit,requiredQuantity,producedQuantity,shopCount";
  const rows = plan.items.map((item) =>
    [
      item.product?.name ?? item.productId,
      item.product?.unit ?? "",
      item.requiredQuantity,
      item.producedQuantity,
      item.shopCount ?? 0,
    ]
      .map(escape)
      .join(","),
  );
  res.send([header, ...rows].join("\n"));
});