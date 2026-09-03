import type { Request, Response } from "express";
import * as deliveryService from "./delivery.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";

export const createDelivery = asyncHandler(async (req: Request, res: Response) => {
  const delivery = await deliveryService.createDelivery(req.body);
  return success(res, delivery, "Delivery created", 201);
});

export const listDeliveries = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, deliveries } = await deliveryService.listDeliveries({
    page,
    limit,
    status: req.query.status as string | undefined,
    deliveryDate: req.query.deliveryDate
      ? new Date(req.query.deliveryDate as string)
      : undefined,
  });
  return paginate(res, deliveries, total, page, limit, "Deliveries fetched");
});

export const getDelivery = asyncHandler(async (req: Request, res: Response) => {
  const delivery = await deliveryService.getDeliveryById(req.params.id);
  return success(res, delivery, "Delivery fetched");
});

export const markDispatched = asyncHandler(async (req: Request, res: Response) => {
  const delivery = await deliveryService.markDispatched(req.params.id, req.body.notes);
  return success(res, delivery, "Delivery dispatched");
});

export const markDelivered = asyncHandler(async (req: Request, res: Response) => {
  const delivery = await deliveryService.markDelivered(req.params.id, req.body);
  return success(res, delivery, "Delivery marked as delivered");
});