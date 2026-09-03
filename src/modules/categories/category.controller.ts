import type { Request, Response } from "express";
import * as categoryService from "./category.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: category.id,
      newValue: category,
    },
    req,
  );
  return success(res, category, "Category created", 201);
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listCategories();
  return success(res, categories, "Categories fetched");
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return success(res, category, "Category fetched");
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: req.params.id,
      oldValue: { id: req.params.id },
      newValue: category,
    },
    req,
  );
  return success(res, category, "Category updated");
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.deleteCategory(req.params.id);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "CATEGORY_DELETED",
      entityType: "Category",
      entityId: req.params.id,
      oldValue: { id: req.params.id },
      newValue: category,
    },
    req,
  );
  return success(res, category, "Category deleted");
});