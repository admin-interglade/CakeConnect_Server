import { prisma } from "../../prisma/index.js";
import { config } from "../../config/index.js";

// Precedence: DATE OVERRIDE -> SHOP OVERRIDE -> GLOBAL DEFAULT
export async function getEffectiveCutoffTime(
  shopId: string,
  deliveryDate: Date,
): Promise<string> {
  const startOfDay = new Date(deliveryDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(deliveryDate);
  endOfDay.setHours(23, 59, 59, 999);

  const dateOverride = await prisma.dateCutoffOverride.findFirst({
    where: { date: { gte: startOfDay, lte: endOfDay } },
    include: { cutoffSetting: true },
  });
  if (dateOverride?.cutoffSetting?.isActive) {
    return dateOverride.cutoffSetting.cutoffTime;
  }

  const shopOverride = await prisma.shopCutoffSetting.findFirst({
    where: { shopId },
    include: { cutoffSetting: true },
  });
  if (shopOverride?.cutoffSetting?.isActive) {
    return shopOverride.cutoffSetting.cutoffTime;
  }

  const globalSetting = await prisma.cutoffSetting.findFirst({
    where: { source: "GLOBAL", isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return globalSetting?.cutoffTime ?? config.globalCutoffTime;
}

export function isHoliday(date: Date): boolean {
  return false;
}

export async function getDeliveryDateCutoffStatus(
  shopId: string,
  deliveryDate: Date,
): Promise<{ cutoffTime: string; cutOffPassed: boolean }> {
  const cutoffTime = await getEffectiveCutoffTime(shopId, deliveryDate);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();
  const deliveryStr = deliveryDate.toDateString();

  // Cutoff only applies to next-day orders. If not tomorrow, allow.
  if (deliveryStr !== tomorrowStr) {
    return { cutoffTime, cutOffPassed: false };
  }

  const [hours, minutes] = cutoffTime.split(":").map(Number);
  const cutoff = new Date(today);
  cutoff.setHours(hours, minutes, 0, 0);

  return { cutoffTime, cutOffPassed: Date.now() > cutoff.getTime() };
}

export async function isValidOrderDate(date: Date): Promise<boolean> {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return target.getTime() === tomorrow.getTime();
}