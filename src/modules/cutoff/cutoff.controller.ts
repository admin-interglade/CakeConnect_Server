import type { Request, Response } from "express";
import * as cutoffService from "./cutoff.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const getGlobalCutoff = asyncHandler(async (_req: Request, res: Response) => {
  const cutoff = await cutoffService.getGlobalCutoff();
  return success(res, cutoff, "Global cutoff fetched");
});

export const setGlobalCutoff = asyncHandler(async (req: Request, res: Response) => {
  const cutoff = await cutoffService.setGlobalCutoff(req.body.cutoffTime);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "GLOBAL_CUTOFF_UPDATED",
      entityType: "CutoffSetting",
      entityId: cutoff.id,
      newValue: cutoff,
    },
    req,
  );
  return success(res, cutoff, "Global cutoff updated");
});

export const setShopCutoff = asyncHandler(async (req: Request, res: Response) => {
  const cutoff = await cutoffService.setShopCutoff(req.body.shopId, req.body.cutoffTime);
  return success(res, cutoff, "Shop cutoff updated");
});

export const setDateCutoff = asyncHandler(async (req: Request, res: Response) => {
  const cutoff = await cutoffService.setDateCutoff(req.body.date, req.body.cutoffTime);
  return success(res, cutoff, "Date cutoff updated");
});

export const addHoliday = asyncHandler(async (req: Request, res: Response) => {
  const holiday = await cutoffService.addHoliday(req.body);
  return success(res, holiday, "Holiday added", 201);
});

export const listHolidays = asyncHandler(async (_req: Request, res: Response) => {
  const holidays = await cutoffService.listHolidays();
  return success(res, holidays, "Holidays fetched");
});

export const deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
  const result = await cutoffService.deleteHoliday(req.params.id);
  return success(res, result, "Holiday deleted");
});

export const effectiveCutoff = asyncHandler(async (req: Request, res: Response) => {
  const result = await cutoffService.getEffectiveCutoffForShop(
    req.params.shopId,
    new Date(req.params.date ?? new Date()),
  );
  return success(res, result, "Effective cutoff fetched");
});

export const getShopCutoff = asyncHandler(async (req: Request, res: Response) => {
  const { getEffectiveCutoffTime } = await import("../../common/utils/cutoff.js");
  const cutoffTime = await getEffectiveCutoffTime(req.params.shopId, new Date());
  return success(res, { shopId: req.params.shopId, cutoffTime }, "Shop effective cutoff fetched");
});