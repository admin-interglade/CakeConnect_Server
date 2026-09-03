import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError, AppError } from "../../common/AppError.js";
import { getEffectiveCutoffTime } from "../../common/utils/cutoff.js";

export async function getGlobalCutoff() {
  const setting = await prisma.cutoffSetting.findFirst({
    where: { source: "GLOBAL", isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return setting ?? null;
}

export async function setGlobalCutoff(cutoffTime: string) {
  const existing = await prisma.cutoffSetting.findFirst({
    where: { source: "GLOBAL", isActive: true },
  });
  if (existing) {
    await prisma.cutoffSetting.updateMany({
      where: { source: "GLOBAL", isActive: true },
      data: { isActive: false },
    });
  }
  return prisma.cutoffSetting.create({
    data: { cutoffTime, source: "GLOBAL" },
  });
}

export async function setShopCutoff(shopId: string, cutoffTime: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  const existingShopOverride = await prisma.shopCutoffSetting.findFirst({
    where: { shopId },
    include: { cutoffSetting: true },
  });

  if (existingShopOverride) {
    await prisma.cutoffSetting.update({
      where: { id: existingShopOverride.cutoffSettingId },
      data: { cutoffTime },
    });
    return existingShopOverride;
  }

  const cutoff = await prisma.cutoffSetting.create({
    data: { cutoffTime, source: "SHOP" },
  });

  return prisma.shopCutoffSetting.create({
    data: { shopId, cutoffSettingId: cutoff.id },
    include: { cutoffSetting: true },
  });
}

export async function setDateCutoff(date: Date, cutoffTime: string) {
  const dateOnly = new Date(date.toISOString().split("T")[0] + "T00:00:00.000Z");
  const existing = await prisma.dateCutoffOverride.findFirst({
    where: { date: dateOnly },
    include: { cutoffSetting: true },
  });

  if (existing) {
    await prisma.cutoffSetting.update({
      where: { id: existing.cutoffSettingId },
      data: { cutoffTime },
    });
    return existing;
  }

  const cutoff = await prisma.cutoffSetting.create({
    data: { cutoffTime, source: "DATE" },
  });

  return prisma.dateCutoffOverride.create({
    data: { date: dateOnly, cutoffSettingId: cutoff.id },
    include: { cutoffSetting: true },
  });
}

export async function addHoliday(data: { date: Date; name: string; isNonDeliveryDay?: boolean }) {
  const dateOnly = new Date(data.date.toISOString().split("T")[0] + "T00:00:00.000Z");
  const existing = await prisma.holiday.findUnique({ where: { date: dateOnly } });
  if (existing) {
    throw new ConflictError("Holiday already exists for this date");
  }
  return prisma.holiday.create({
    data: {
      date: dateOnly,
      name: data.name,
      isNonDeliveryDay: data.isNonDeliveryDay ?? false,
    },
  });
}

export async function listHolidays() {
  return prisma.holiday.findMany({
    orderBy: { date: "asc" },
  });
}

export async function deleteHoliday(id: string) {
  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Holiday not found");
  }
  await prisma.holiday.delete({ where: { id } });
  return { message: "Holiday deleted" };
}

export async function getEffectiveCutoffForShop(shopId: string, deliveryDate: Date) {
  const cutoffTime = await getEffectiveCutoffTime(shopId, deliveryDate);
  return { shopId, deliveryDate, cutoffTime };
}