import type { Request, Response } from "express";
import * as orderService from "./order.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createDraftOrder(req.body, req.user!);
  return success(res, order, "Draft order created", 201);
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, orders } = await orderService.getOrders({
    page,
    limit,
    status: req.query.status as string | undefined,
    shopId: req.query.shopId as string | undefined,
    deliveryDate: req.query.deliveryDate
      ? new Date(req.query.deliveryDate as string)
      : undefined,
    search: req.query.search as string | undefined,
    user: req.user!,
  });
  return paginate(res, orders, total, page, limit, "Orders fetched");
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(req.params.id, req.user!);
  return success(res, order, "Order fetched");
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const before = await orderService.getOrderById(req.params.id, req.user!);
  const order = await orderService.updateDraftOrder(
    req.params.id,
    {
      notes: req.body.notes,
      deliveryDate: req.body.deliveryDate,
      items: req.body.items,
    },
    req.user!,
  );
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "ORDER_UPDATED",
      entityType: "Order",
      entityId: req.params.id,
      oldValue: before,
      newValue: order,
    },
    req,
  );
  return success(res, order, "Order updated");
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.deleteDraftOrder(req.params.id, req.user!);
  return success(res, result, "Draft deleted");
});

export const submitOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.submitOrder(req.params.id, req.user!);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "ORDER_SUBMITTED",
      entityType: "Order",
      entityId: req.params.id,
      newValue: { status: order.status },
    },
    req,
  );
  return success(res, order, "Order submitted");
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.cancelOrder(req.params.id, req.user!);
  return success(res, order, "Order cancelled");
});

export const repeatLast = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.repeatOrder(
    {
      shopId: req.body.shopId,
      deliveryDate: req.body.deliveryDate,
    },
    req.user!,
  );
  return success(res, order, "Last order repeated", 201);
});

export const repeatWeekday = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.repeatWeekdayOrder(
    {
      shopId: req.body.shopId,
      deliveryDate: req.body.deliveryDate,
    },
    req.user!,
  );
  return success(res, order, "Weekday order repeated", 201);
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const before = await orderService.getOrderById(req.params.id, req.user!);
  const order = await orderService.updateOrderStatus(
    req.params.id,
    req.body.status,
    req.user!,
  );
  await logAudit(
    {
      actorId: req.user!.userId,
      action: `ORDER_STATUS_${req.body.status}`,
      entityType: "Order",
      entityId: req.params.id,
      oldValue: { status: before.status },
      newValue: { status: order.status },
    },
    req,
  );
  return success(res, order, "Order status updated");
});