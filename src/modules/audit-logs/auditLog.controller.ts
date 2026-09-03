import type { Request, Response } from "express";
import * as auditLogService from "./auditLog.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { paginate, getPagination } from "../../common/response.js";

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, logs } = await auditLogService.listAuditLogs({
    page,
    limit,
    actorId: req.query.actorId as string | undefined,
    action: req.query.action as string | undefined,
    entityType: req.query.entityType as string | undefined,
    entityId: req.query.entityId as string | undefined,
  });
  return paginate(res, logs, total, page, limit, "Audit logs fetched");
});