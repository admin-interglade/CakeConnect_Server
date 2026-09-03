import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError } from "../../common/AppError.js";

export async function createCategory(data: {
  name: string;
  description?: string;
  imageUrl?: string;
  leadTimeHours?: number;
}) {
  const existing = await prisma.category.findUnique({
    where: { name: data.name },
  });
  if (existing) {
    throw new ConflictError("Category with this name already exists");
  }
  return prisma.category.create({
    data: {
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      leadTimeHours: data.leadTimeHours,
    },
  });
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      products: {
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!category) {
    throw new NotFoundError("Category not found");
  }
  return category;
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    imageUrl?: string;
    leadTimeHours?: number;
    isActive?: boolean;
  },
) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Category not found");
  }
  return prisma.category.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
      ...(data.leadTimeHours !== undefined ? { leadTimeHours: data.leadTimeHours } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Category not found");
  }
  return prisma.category.update({
    where: { id },
    data: { isActive: false },
  });
}