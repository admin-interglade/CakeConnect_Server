import { Router } from "express";
import * as ctrl from "./shop.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  createShopSchema,
  updateShopSchema,
  shopStatusSchema,
  assignOwnerSchema,
  creditLimitSchema,
  assignPriceListSchema,
  shopIdParams,
  listShopsQuery,
} from "./shop.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const shopRouter = Router();

shopRouter.use(authenticate);

// Shop owner convenience endpoint with no shop id - returns own shops
shopRouter.post("/", authorize("ADMIN"), validateBody(createShopSchema), ctrl.createShop);
shopRouter.get("/", validateQuery(listShopsQuery), ctrl.listShops);
shopRouter.patch("/:id/status", authorize("ADMIN"), validateParams(shopIdParams), validateBody(shopStatusSchema), ctrl.setStatus);
shopRouter.patch("/:id/credit-limit", authorize("ADMIN"), validateParams(shopIdParams), validateBody(creditLimitSchema), ctrl.setCreditLimit);
shopRouter.post("/:id/assign-owner", authorize("ADMIN"), validateParams(shopIdParams), validateBody(assignOwnerSchema), ctrl.assignOwner);
shopRouter.post("/:id/assign-price-list", authorize("ADMIN"), validateParams(shopIdParams), validateBody(assignPriceListSchema), ctrl.assignPriceList);
shopRouter.delete("/:id", authorize("ADMIN"), validateParams(shopIdParams), ctrl.deleteShop);
shopRouter.get("/:id", validateParams(shopIdParams), ctrl.getShop);
shopRouter.patch("/:id", validateParams(shopIdParams), validateBody(updateShopSchema), ctrl.updateShop);