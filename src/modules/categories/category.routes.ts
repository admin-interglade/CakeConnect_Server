import { Router } from "express";
import * as ctrl from "./category.controller.js";
import {
  validateBody,
  validateParams,
} from "../../common/middleware/validate.js";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParams,
} from "./category.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const categoryRouter = Router();

categoryRouter.get("/", authenticate, ctrl.listCategories);
categoryRouter.get("/:id", authenticate, validateParams(categoryIdParams), ctrl.getCategory);
categoryRouter.use(authenticate);
categoryRouter.post("/", authorize("ADMIN"), validateBody(createCategorySchema), ctrl.createCategory);
categoryRouter.patch("/:id", authorize("ADMIN"), validateParams(categoryIdParams), validateBody(updateCategorySchema), ctrl.updateCategory);
categoryRouter.delete("/:id", authorize("ADMIN"), validateParams(categoryIdParams), ctrl.deleteCategory);