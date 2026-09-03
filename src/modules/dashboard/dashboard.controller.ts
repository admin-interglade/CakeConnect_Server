import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success } from "../../common/response.js";
import { resolveDateRange } from "./dashboard.validator.js";

export const getShopOwnerDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = resolveDateRange(
    req.query.period as string,
    req.query.from ? new Date(req.query.from as string) : undefined,
    req.query.to ? new Date(req.query.to as string) : undefined,
  );
  const data = await dashboardService.getShopOwnerDashboard({
    userId: req.user!.userId,
    shopIds: req.user!.shopIds ?? [],
    start,
    end,
  });
  return success(res, data, "Dashboard fetched");
});

export const getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = resolveDateRange(
    req.query.period as string,
    req.query.from ? new Date(req.query.from as string) : undefined,
    req.query.to ? new Date(req.query.to as string) : undefined,
  );
  const data = await dashboardService.getAdminDashboard({ start, end });
  return success(res, data, "Admin dashboard fetched");
});