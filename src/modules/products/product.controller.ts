import type { Request, Response } from "express";
import * as productService from "./product.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product.id,
      newValue: product,
    },
    req,
  );
  return success(res, product, "Product created", 201);
});

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, products } = await productService.listProducts({
    page,
    limit,
    status: req.query.status as string | undefined,
    categoryId: req.query.categoryId as string | undefined,
    search: req.query.search as string | undefined,
  });
  return paginate(res, products, total, page, limit, "Products fetched");
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  return success(res, product, "Product fetched");
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const before = await productService.getProductById(req.params.id);
  const product = await productService.updateProduct(req.params.id, req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: req.params.id,
      oldValue: before,
      newValue: product,
    },
    req,
  );
  return success(res, product, "Product updated");
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const before = await productService.getProductById(req.params.id);
  const product = await productService.deleteProduct(req.params.id);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "PRODUCT_DELETED",
      entityType: "Product",
      entityId: req.params.id,
      oldValue: before,
      newValue: product,
    },
    req,
  );
  return success(res, product, "Product deleted");
});

export const setAvailability = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.setAvailability({
    productId: req.params.id,
    date: req.body.date,
    available: req.body.available,
    note: req.body.note,
  });
  return success(res, result, "Product availability updated");
});

export const clearAvailability = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.clearAvailability(req.params.id, req.body.date);
  return success(res, result, "Product availability cleared");
});