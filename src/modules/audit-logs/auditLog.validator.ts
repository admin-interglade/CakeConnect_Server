import { z } from "zod";

export const listAuditLogsQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});