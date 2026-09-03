import { prisma } from "../../prisma/index.js";
import type { Request } from "express";

export async function logAudit(
  data: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
  req?: Request,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValue: data.oldValue ? JSON.parse(JSON.stringify(data.oldValue)) : undefined,
        newValue: data.newValue ? JSON.parse(JSON.stringify(data.newValue)) : undefined,
        ipAddress: req?.ip,
        userAgent: req?.headers["user-agent"],
      },
    });
  } catch (err) {
    // Audit logging should never break the main operation
    // eslint-disable-next-line no-console
    console.error("Failed to write audit log", err);
  }
}
