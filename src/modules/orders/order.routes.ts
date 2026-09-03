import { Router } from "express";
import * as ctrl from "./order.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  createOrderSchema,
  updateOrderSchema,
  orderIdParams,
  listOrdersQuery,
  statusTransitionSchema,
  repeatSchema,
} from "./order.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const orderRouter = Router();

orderRouter.use(authenticate);

orderRouter.get("/", validateQuery(listOrdersQuery), ctrl.listOrders);
orderRouter.post("/", validateBody(createOrderSchema), ctrl.createOrder);
orderRouter.post("/repeat-last", validateBody(repeatSchema), ctrl.repeatLast);
orderRouter.post("/repeat-weekday", validateBody(repeatSchema), ctrl.repeatWeekday);
orderRouter.get("/:id", validateParams(orderIdParams), ctrl.getOrder);
orderRouter.patch("/:id", validateParams(orderIdParams), validateBody(updateOrderSchema), ctrl.updateOrder);
orderRouter.delete("/:id", validateParams(orderIdParams), ctrl.deleteOrder);
orderRouter.post("/:id/submit", validateParams(orderIdParams), ctrl.submitOrder);
orderRouter.post("/:id/cancel", validateParams(orderIdParams), ctrl.cancelOrder);
orderRouter.patch("/:id/status", validateParams(orderIdParams), validateBody(statusTransitionSchema), ctrl.updateStatus);