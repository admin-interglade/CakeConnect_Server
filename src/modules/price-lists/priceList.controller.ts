import type { Request, Response } from "express";
import * as priceListService from "./priceList.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createPriceList = asyncHandler(async (req: Request, res: Response) => {
  const priceList = await priceListService.createPriceList(req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "PRICE_LIST_CREATED",
      entityType: "PriceList",
      entityId: priceList.id,
      newValue: priceList,
    },
    req,
  );
  return success(res, priceList, "Price list created", 201);
});

export const listPriceLists = asyncHandler(async (_req: Request, res: Response) => {
  const priceLists = await priceListService.listPriceLists();
  return success(res, priceLists, "Price lists fetched");
});

export const getPriceList = asyncHandler(async (req: Request, res: Response) => {
  const priceList = await priceListService.getPriceListById(req.params.id);
  return success(res, priceList, "Price list fetched");
});

export const updatePriceList = asyncHandler(async (req: Request, res: Response) => {
  const priceList = await priceListService.updatePriceList(req.params.id, req.body);
  return success(res, priceList, "Price list updated");
});

export const deletePriceList = asyncHandler(async (req: Request, res: Response) => {
  const priceList = await priceListService.deletePriceList(req.params.id);
  return success(res, priceList, "Price list deleted");
});

export const addItems = asyncHandler(async (req: Request, res: Response) => {
  const priceList = await priceListService.addItems(req.params.id, req.body.items);
  return success(res, priceList, "Products added to price list");
});

export const updateItemPrice = asyncHandler(async (req: Request, res: Response) => {
  const item = await priceListService.updateItemPrice(
    req.params.id,
    req.params.itemId,
    req.body.price,
  );
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "PRICE_ITEM_UPDATED",
      entityType: "PriceListItem",
      entityId: item.id,
      newValue: item,
    },
    req,
  );
  return success(res, item, "Price updated");
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await priceListService.removeItem(req.params.id, req.body.productId);
  return success(res, item, "Product removed from price list");
});

export const shopApplicablePrice = asyncHandler(async (req: Request, res: Response) => {
  const price = await priceListService.getApplicablePrice(
    req.params.shopId,
    req.params.productId,
  );
  return success(res, price, "Applicable price fetched");
});