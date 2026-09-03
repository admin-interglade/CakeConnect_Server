import { Router } from "express";
import * as ctrl from "./delivery.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  createDeliverySchema,
  deliveryIdParams,
  markDispatchedSchema,
  markDeliveredSchema,
  listDeliveriesQuery,
} from "./delivery.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const deliveryRouter = Router();

deliveryRouter.use(authenticate);

deliveryRouter.get("/", validateQuery(listDeliveriesQuery), ctrl.listDeliveries);
deliveryRouter.post("/", authorize("ADMIN", "SUPPORT_STAFF"), validateBody(createDeliverySchema), ctrl.createDelivery);
deliveryRouter.get("/:id", validateParams(deliveryIdParams), ctrl.getDelivery);
deliveryRouter.post("/:id/dispatch", authorize("ADMIN", "SUPPORT_STAFF"), validateParams(deliveryIdParams), validateBody(markDispatchedSchema), ctrl.markDispatched);
deliveryRouter.post("/:id/deliver", authorize("ADMIN", "SUPPORT_STAFF"), validateParams(deliveryIdParams), validateBody(markDeliveredSchema), ctrl.markDelivered);