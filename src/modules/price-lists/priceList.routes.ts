import { Router } from "express";
import * as ctrl from "./priceList.controller.js";
import {
  validateBody,
  validateParams,
} from "../../common/middleware/validate.js";
import {
  createPriceListSchema,
  updatePriceListSchema,
  addItemSchema,
  removeItemSchema,
  priceListIdParams,
  itemIdParams,
} from "./priceList.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { z } from "zod";

const shopProductParams = z.object({
  shopId: z.string().uuid(),
  productId: z.string().uuid(),
});

export const priceListRouter = Router();

priceListRouter.use(authenticate);

priceListRouter.get("/", ctrl.listPriceLists);
priceListRouter.get("/:id", validateParams(priceListIdParams), ctrl.getPriceList);
priceListRouter.get("/shops/:shopId/products/:productId", validateParams(shopProductParams), ctrl.shopApplicablePrice);

priceListRouter.use(authorize("ADMIN"));
priceListRouter.post("/", validateBody(createPriceListSchema), ctrl.createPriceList);
priceListRouter.patch("/:id", validateParams(priceListIdParams), validateBody(updatePriceListSchema), ctrl.updatePriceList);
priceListRouter.delete("/:id", validateParams(priceListIdParams), ctrl.deletePriceList);
priceListRouter.post("/:id/items", validateParams(priceListIdParams), validateBody(addItemSchema), ctrl.addItems);
priceListRouter.patch("/:id/items/:itemId", validateParams(priceListIdParams.merge(itemIdParams)), validateBody(z.object({ price: z.coerce.number().nonnegative() })), ctrl.updateItemPrice);
priceListRouter.delete("/:id/items", validateParams(priceListIdParams), validateBody(removeItemSchema), ctrl.removeItem);