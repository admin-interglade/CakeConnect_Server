import type { Request, Response } from "express";
import * as shopService from "./shop.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createShop = asyncHandler(async (req: Request, res: Response) => {
  const shop = await shopService.createShop(req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "SHOP_CREATED",
      entityType: "Shop",
      entityId: shop!.id,
      newValue: shop,
    },
    req,
  );
  return success(res, shop, "Shop created", 201);
});

export const listShops = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, shops } = await shopService.listShops({
    page,
    limit,
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    city: req.query.city as string | undefined,
    user: req.user,
  });
  return paginate(res, shops, total, page, limit, "Shops fetched");
});

export const getShop = asyncHandler(async (req: Request, res: Response) => {
  const shop = await shopService.getShopById(req.params.id, req.user);
  return success(res, shop, "Shop fetched");
});

export const updateShop = asyncHandler(async (req: Request, res: Response) => {
  const before = await shopService.getShopById(req.params.id, req.user);
  const shop = await shopService.updateShop(req.params.id, req.body, req.user);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "SHOP_UPDATED",
      entityType: "Shop",
      entityId: req.params.id,
      oldValue: before,
      newValue: shop,
    },
    req,
  );
  return success(res, shop, "Shop updated");
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  const before = await shopService.getShopById(req.params.id, req.user);
  const shop = await shopService.setShopStatus(req.params.id, req.body.status);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: `SHOP_STATUS_${req.body.status}`,
      entityType: "Shop",
      entityId: req.params.id,
      oldValue: before,
      newValue: shop,
    },
    req,
  );
  return success(res, shop, "Shop status updated");
});

export const deleteShop = asyncHandler(async (req: Request, res: Response) => {
  const before = await shopService.getShopById(req.params.id, req.user);
  const shop = await shopService.deleteShop(req.params.id);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "SHOP_DELETED",
      entityType: "Shop",
      entityId: req.params.id,
      oldValue: before,
      newValue: shop,
    },
    req,
  );
  return success(res, shop, "Shop deleted");
});

export const setCreditLimit = asyncHandler(async (req: Request, res: Response) => {
  const before = await shopService.getShopById(req.params.id, req.user);
  const shop = await shopService.setCreditLimit(req.params.id, {
    creditLimit: req.body.creditLimit,
    creditBehavior: req.body.creditBehavior,
  });
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "CREDIT_LIMIT_UPDATED",
      entityType: "Shop",
      entityId: req.params.id,
      oldValue: before,
      newValue: shop,
    },
    req,
  );
  return success(res, shop, "Credit limit updated");
});

export const assignOwner = asyncHandler(async (req: Request, res: Response) => {
  const shop = await shopService.assignShopOwner(req.params.id, req.body.userId);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "SHOP_OWNER_ASSIGNED",
      entityType: "Shop",
      entityId: req.params.id,
      newValue: shop,
    },
    req,
  );
  return success(res, shop, "Shop owner assigned");
});

export const assignPriceList = asyncHandler(async (req: Request, res: Response) => {
  const shop = await shopService.assignPriceList(req.params.id, req.body.priceListId);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "SHOP_PRICE_LIST_ASSIGNED",
      entityType: "Shop",
      entityId: req.params.id,
      newValue: shop,
    },
    req,
  );
  return success(res, shop, "Price list assigned");
});