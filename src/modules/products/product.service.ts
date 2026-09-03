import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError } from "../../common/AppError.js";

export async function createProduct(data: {
  name: string;
  sku: string;
  categoryId: string;
  description?: string;
  imageUrl?: string;
  unit?: string;
  basePrice: number;
  minimumOrderQuantity?: number;
  packSize?: number;
}) {
  const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existing) {
    throw new ConflictError("Product with this SKU already exists");
  }
  return prisma.product.create({
    data: {
      name: data.name,
      sku: data.sku,
      categoryId: data.categoryId,
      description: data.description,
      imageUrl: data.imageUrl,
      unit: data.unit || "piece",
      basePrice: data.basePrice,
      minimumOrderQuantity: data.minimumOrderQuantity ?? 1,
      packSize: data.packSize ?? 1,
    },
    include: { category: true },
  });
}

export async function listProducts(query: {
  page: number;
  limit: number;
  status?: string;
  categoryId?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { sku: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { category: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { total, products };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      availability: { orderBy: { date: "asc" } },
    },
  });
  if (!product) {
    throw new NotFoundError("Product not found");
  }
  return product;
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    description?: string;
    imageUrl?: string;
    unit?: string;
    basePrice?: number;
    minimumOrderQuantity?: number;
    packSize?: number;
    status?: string;
    categoryId?: string;
  },
) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Product not found");
  }
  return prisma.product.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
      ...(data.unit ? { unit: data.unit } : {}),
      ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
      ...(data.minimumOrderQuantity !== undefined
        ? { minimumOrderQuantity: data.minimumOrderQuantity }
        : {}),
      ...(data.packSize !== undefined ? { packSize: data.packSize } : {}),
      ...(data.status ? { status: data.status as never } : {}),
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
    },
    include: { category: true },
  });
}

export async function deleteProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Product not found");
  }
  return prisma.product.update({
    where: { id },
    data: { status: "INACTIVE" },
  });
}

export async function setAvailability(data: {
  productId: string;
  date: Date;
  available: boolean;
  note?: string;
}) {
  const existing = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!existing) {
    throw new NotFoundError("Product not found");
  }
  const dateOnly = new Date(data.date.toISOString().split("T")[0]+"T00:00:00.000Z");
  const result = await prisma.productAvailability.upsert({
    where: {
      productId_date: { productId: data.productId, date: dateOnly },
    },
    update: { available: data.available, note: data.note },
    create: {
      productId: data.productId,
      date: dateOnly,
      available: data.available,
      note: data.note,
    },
  });
  return result;
}

export async function clearAvailability(productId: string, date: Date) {
  const dateOnly = new Date(date.toISOString().split("T")[0]+"T00:00:00.000Z");
  await prisma.productAvailability.deleteMany({
    where: { productId, date: dateOnly },
  });
  return { message: "Availability cleared" };
}