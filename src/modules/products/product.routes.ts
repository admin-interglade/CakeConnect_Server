import { Router } from "express";
import * as ctrl from "./product.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  createProductSchema,
  updateProductSchema,
  productIdParams,
  listProductsQuery,
  setAvailabilitySchema,
  clearAvailabilitySchema,
} from "./product.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get("/", validateQuery(listProductsQuery), ctrl.listProducts);
productRouter.get("/:id", validateParams(productIdParams), ctrl.getProduct);
productRouter.post("/:id/availability", authorize("ADMIN"), validateParams(productIdParams), validateBody(setAvailabilitySchema), ctrl.setAvailability);
productRouter.delete("/:id/availability", authorize("ADMIN"), validateParams(productIdParams), validateBody(clearAvailabilitySchema), ctrl.clearAvailability);
productRouter.post("/", authorize("ADMIN"), validateBody(createProductSchema), ctrl.createProduct);
productRouter.patch("/:id", authorize("ADMIN"), validateParams(productIdParams), validateBody(updateProductSchema), ctrl.updateProduct);
productRouter.delete("/:id", authorize("ADMIN"), validateParams(productIdParams), ctrl.deleteProduct);