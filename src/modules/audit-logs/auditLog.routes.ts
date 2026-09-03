import { Router } from "express";
import * as ctrl from "./auditLog.controller.js";
import { validateQuery } from "../../common/middleware/validate.js";
import { listAuditLogsQuery } from "./auditLog.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const auditLogRouter = Router();

auditLogRouter.use(authenticate);
auditLogRouter.get("/", authorize("ADMIN"), validateQuery(listAuditLogsQuery), ctrl.listAuditLogs);