import { z } from "zod";

export const dashboardQuery = z.object({
  period: z
    .enum(["TODAY", "YESTERDAY", "THIS_WEEK", "THIS_MONTH", "LAST_MONTH", "CUSTOM"])
    .default("THIS_MONTH"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  shopId: z.string().uuid().optional(),
});

export const shopIdParams = z.object({
  shopId: z.string().uuid(),
});

export function resolveDateRange(period: string, from?: Date, to?: Date) {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (period) {
    case "TODAY": {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "YESTERDAY": {
      start = new Date(now);
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "THIS_WEEK": {
      const day = now.getDay() || 7;
      start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "THIS_MONTH": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case "LAST_MONTH": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "CUSTOM": {
      if (!from || !to) {
        throw new Error("Custom period requires from and to");
      }
      start = from;
      end = to;
      break;
    }
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { start, end };
}