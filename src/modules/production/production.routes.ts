import { Router } from "express";
import * as ctrl from "./production.controller.js";
import {
  validateBody,
  validateParams,
} from "../../common/middleware/validate.js";
import {
  generatePlanSchema,
  productionDateParams,
  planIdParams,
  updatePlanSchema,
} from "./production.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const productionRouter = Router();

productionRouter.use(authenticate);

productionRouter.get("/", ctrl.listPlans);
productionRouter.get("/date/:date", validateParams(productionDateParams), ctrl.getPlanByDate);
productionRouter.get("/date/:date/export", validateParams(productionDateParams), ctrl.exportPlan);
productionRouter.get("/:id", validateParams(planIdParams), ctrl.getPlan);

productionRouter.use(authorize("ADMIN", "SUPPORT_STAFF"));
productionRouter.post("/generate", validateBody(generatePlanSchema), ctrl.generatePlan);
productionRouter.patch("/:id", validateParams(planIdParams), validateBody(updatePlanSchema), ctrl.updatePlan);