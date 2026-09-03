import { Router } from "express";
import * as ctrl from "./dashboard.controller.js";
import { validateQuery } from "../../common/middleware/validate.js";
import { dashboardQuery } from "./dashboard.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/shop-owner", validateQuery(dashboardQuery), ctrl.getShopOwnerDashboard);
dashboardRouter.get("/admin", authorize("ADMIN"), validateQuery(dashboardQuery), ctrl.getAdminDashboard);