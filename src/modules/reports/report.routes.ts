import { Router } from "express";
import * as ctrl from "./report.controller.js";
import { validateQuery } from "../../common/middleware/validate.js";
import { reportsQuery, listReportsQuery } from "./report.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const reportRouter = Router();

reportRouter.use(authenticate);

reportRouter.get("/sales", validateQuery(reportsQuery), ctrl.sales);
reportRouter.get("/order-trends", validateQuery(reportsQuery), ctrl.orderTrends);
reportRouter.get("/outstanding", authorize("ADMIN"), ctrl.outstanding);
reportRouter.get("/collections", validateQuery(reportsQuery), ctrl.collections);
reportRouter.get("/cutoff-compliance", authorize("ADMIN"), validateQuery(reportsQuery), ctrl.cutoffCompliance);