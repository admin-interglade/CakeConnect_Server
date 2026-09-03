import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError } from "../../common/AppError.js";

export async function createPriceList(data: {
  name: string;
  region?: string;
  description?: string;
  items?: { productId: string; price: number }[];
}) {
  return prisma.priceList.create({
    data: {
      name: data.name,
      region: data.region,
      description: data.description,
      items: data.items
        ? {
            create: data.items.map((item) => ({
              productId: item.productId,
              price: item.price,
            })),
          }
        : undefined,
    },
    include: { items: { include: { product: true } } },
  });
}

export async function listPriceLists() {
  return prisma.priceList.findMany({
    include: {
      items: { include: { product: true } },
      _count: { select: { shops: true } },
    },
  });
}

export async function getPriceListById(id: string) {
  const priceList = await prisma.priceList.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      shops: { include: { shop: true } },
    },
  });
  if (!priceList) {
    throw new NotFoundError("Price list not found");
  }
  return priceList;
}

export async function updatePriceList(
  id: string,
  data: {
    name?: string;
    region?: string;
    description?: string;
    isActive?: boolean;
  },
) {
  const existing = await prisma.priceList.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Price list not found");
  }
  return prisma.priceList.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.region !== undefined ? { region: data.region } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: { items: { include: { product: true } } },
  });
}

export async function deletePriceList(id: string) {
  const existing = await prisma.priceList.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Price list not found");
  }
  return prisma.priceList.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function addItems(
  id: string,
  items: { productId: string; price: number }[],
) {
  const existing = await prisma.priceList.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Price list not found");
  }

  const existingItems = await prisma.priceListItem.findMany({
    where: { priceListId: id },
    select: { productId: true },
  });
  const existingProductIds = new Set(existingItems.map((e) => e.productId));

  const toCreate = items
    .filter((item) => !existingProductIds.has(item.productId))
    .map((item) => ({
      priceListId: id,
      productId: item.productId,
      price: item.price,
    }));

  if (toCreate.length > 0) {
    await prisma.priceListItem.createMany({ data: toCreate });
  }

  return prisma.priceList.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });
}

export async function updateItemPrice(priceListId: string, itemId: string, price: number) {
  const item = await prisma.priceListItem.findFirst({
    where: { id: itemId, priceListId },
  });
  if (!item) {
    throw new NotFoundError("Price list item not found");
  }
  return prisma.priceListItem.update({
    where: { id: itemId },
    data: { price },
  });
}

export async function removeItem(priceListId: string, productId: string) {
  const item = await prisma.priceListItem.findFirst({
    where: { priceListId, productId },
  });
  if (!item) {
    throw new NotFoundError("Price list item not found");
  }
  return prisma.priceListItem.delete({ where: { id: item.id } });
}

export async function getApplicablePrice(shopId: string, productId: string) {
  const association = await prisma.shopPriceList.findFirst({
    where: { shopId },
    include: { priceList: { include: { items: true } } },
  });

  if (!association) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return { source: "BASE_PRICE", price: Number(product.basePrice) };
  }

  const item = association.priceList.items.find((i) => i.productId === productId);
  if (!item) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    return {
      source: "BASE_PRICE",
      price: product ? Number(product.basePrice) : 0,
    };
  }

  return { source: "PRICE_LIST", price: Number(item.price), priceListName: association.priceList.name };
}

export async function getShopPriceList(shopId: string) {
  const association = await prisma.shopPriceList.findFirst({
    where: { shopId },
    include: { priceList: { include: { items: { include: { product: true } } } } },
  });
  return association?.priceList ?? null;
}