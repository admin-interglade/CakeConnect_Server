import { prisma } from "../../prisma/index.js";
import { NotFoundError, AppError } from "../../common/AppError.js";

export async function createOffer(data: {
  title: string;
  description?: string;
  bannerUrl?: string;
  discountType: "PERCENTAGE" | "FLAT" | "BUY_X_GET_Y";
  discountValue: number;
  buyQuantity?: number;
  getQuantity?: number;
  startDate: Date;
  endDate: Date;
  status?: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "WITHDRAWN";
  targetAllShops?: boolean;
  productIds?: string[];
  shopIds?: string[];
  regions?: string[];
}) {
  if (data.endDate < data.startDate) {
    throw new AppError("End date must be after start date", 400);
  }
  if (
    data.discountType === "BUY_X_GET_Y" &&
    (!data.buyQuantity || !data.getQuantity)
  ) {
    throw new AppError("buyQuantity and getQuantity required for BUY_X_GET_Y", 400);
  }

  const now = new Date();
  const status =
    data.status ??
    (data.startDate <= now && data.endDate >= now ? "ACTIVE" : "SCHEDULED");

  return prisma.offer.create({
    data: {
      title: data.title,
      description: data.description,
      bannerUrl: data.bannerUrl,
      discountType: data.discountType,
      discountValue: data.discountValue,
      buyQuantity: data.buyQuantity,
      getQuantity: data.getQuantity,
      startDate: data.startDate,
      endDate: data.endDate,
      status,
      targetAllShops: data.targetAllShops ?? true,
      products: data.productIds
        ? { create: data.productIds.map((p) => ({ productId: p })) }
        : undefined,
      shops: data.shopIds
        ? { create: data.shopIds.map((s) => ({ shopId: s })) }
        : undefined,
      regions: data.regions
        ? { create: data.regions.map((r) => ({ region: r })) }
        : undefined,
    },
    include: { products: true, shops: true, regions: true },
  });
}

export async function listOffers(query: {
  page: number;
  limit: number;
  status?: string;
  userRole?: string;
  shopIds?: string[];
}) {
  const where: Record<string, unknown> = {
    ...(query.status ? { status: query.status as never } : {}),
  };

  if (query.userRole === "SHOP_OWNER") {
    where.OR = [
      { targetAllShops: true },
      { shops: { some: { shopId: { in: query.shopIds ?? [] } } } },
    ];
  }

  const [total, offers] = await prisma.$transaction([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { updatedAt: "desc" },
      include: { products: true, shops: true, regions: true },
    }),
  ]);

  return { total, offers };
}

export async function getOfferById(id: string, userRole?: string, shopIds?: string[]) {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { products: { include: { product: true } }, shops: { include: { shop: true } }, regions: true },
  });
  if (!offer) {
    throw new NotFoundError("Offer not found");
  }
  if (
    userRole === "SHOP_OWNER" &&
    !offer.targetAllShops &&
    !offer.shops.some((s) => shopIds?.includes(s.shopId))
  ) {
    throw new AppError("You do not have access to this offer", 403);
  }
  return offer;
}

export async function updateOffer(id: string, data: {
  title?: string;
  description?: string;
  bannerUrl?: string;
  discountType?: "PERCENTAGE" | "FLAT" | "BUY_X_GET_Y";
  discountValue?: number;
  buyQuantity?: number;
  getQuantity?: number;
  startDate?: Date;
  endDate?: Date;
  status?: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "WITHDRAWN";
}) {
  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Offer not found");
  }
  return prisma.offer.update({
    where: { id },
    data: {
      ...(data.title ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl || null } : {}),
      ...(data.discountType ? { discountType: data.discountType } : {}),
      ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
      ...(data.buyQuantity !== undefined ? { buyQuantity: data.buyQuantity } : {}),
      ...(data.getQuantity !== undefined ? { getQuantity: data.getQuantity } : {}),
      ...(data.startDate ? { startDate: data.startDate } : {}),
      ...(data.endDate ? { endDate: data.endDate } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    include: { products: true, shops: true, regions: true },
  });
}

export async function withdrawOffer(id: string, reason?: string) {
  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Offer not found");
  }
  return prisma.offer.update({
    where: { id },
    data: { status: "WITHDRAWN" },
  });
}

export async function trackOfferView(id: string) {
  await prisma.offer.update({
    where: { id },
    data: { views: { increment: 1 } },
  });
  return { message: "Offer view tracked" };
}