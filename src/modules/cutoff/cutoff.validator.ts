import { z } from "zod";

export const cutoffSourceSchema = z.enum(["GLOBAL", "SHOP", "DATE"]);

export const setGlobalCutoffSchema = z.object({
  cutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)"),
});

export const setShopCutoffSchema = z.object({
  shopId: z.string().uuid(),
  cutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)"),
});

export const setDateCutoffSchema = z.object({
  date: z.coerce.date(),
  cutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)"),
});

export const addHolidaySchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1),
  isNonDeliveryDay: z.boolean().default(false),
});

export const holidayIdParams = z.object({
  id: z.string().uuid(),
});

export const deleteHolidaySchema = z.object({
  id: z.string().uuid(),
});

export const removeShopOverrideSchema = z.object({
  shopId: z.string().uuid(),
});