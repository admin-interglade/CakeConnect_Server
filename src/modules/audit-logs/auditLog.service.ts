import { prisma } from "../../prisma/index.js";

export async function listAuditLogs(query: {
  page: number;
  limit: number;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}) {
  const where = {
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, mobileNumber: true, role: true } },
      },
    }),
  ]);

  return { total, logs };
}