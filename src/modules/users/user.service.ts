import bcrypt from "bcryptjs";
import { prisma } from "../../prisma/index.js";
import {
  NotFoundError,
  ConflictError,
  AppError,
} from "../../common/AppError.js";

export async function createUser(data: {
  name: string;
  mobileNumber: string;
  email?: string;
  role?: string;
  password?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { mobileNumber: data.mobileNumber },
  });
  if (existing) {
    throw new ConflictError("User with this mobile number already exists");
  }

  let passwordHash: string | undefined;
  if (data.password) {
    passwordHash = await bcrypt.hash(data.password, 10);
  }

  return prisma.user.create({
    data: {
      name: data.name,
      mobileNumber: data.mobileNumber,
      email: data.email,
      role: (data.role as "ADMIN" | "SHOP_OWNER" | "SUPPORT_STAFF") || "SHOP_OWNER",
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      mobileNumber: true,
      email: true,
      role: true,
      status: true,
      profileImage: true,
      createdAt: true,
    },
  });
}

export async function listUsers(query: {
  page: number;
  limit: number;
  role?: string;
  status?: string;
  search?: string;
}) {
  const where = {
    ...(query.role ? { role: query.role as never } : {}),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { mobileNumber: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        name: true,
        mobileNumber: true,
        email: true,
        role: true,
        status: true,
        profileImage: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { total, users };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      mobileNumber: true,
      email: true,
      role: true,
      status: true,
      profileImage: true,
      createdAt: true,
      updatedAt: true,
      shopUsers: { include: { shop: true } },
    },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: string;
    status?: string;
  },
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("User not found");
  }
  return prisma.user.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role ? { role: data.role as never } : {}),
      ...(data.status ? { status: data.status as never } : {}),
    },
    select: {
      id: true,
      name: true,
      mobileNumber: true,
      email: true,
      role: true,
      status: true,
      profileImage: true,
      createdAt: true,
    },
  });
}

export async function updateProfile(
  userId: string,
  data: { name?: string; email?: string; profileImage?: string },
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.profileImage !== undefined ? { profileImage: data.profileImage } : {}),
    },
    select: {
      id: true,
      name: true,
      mobileNumber: true,
      email: true,
      role: true,
      status: true,
      profileImage: true,
    },
  });
}

export async function setUserStatus(id: string, status: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("User not found");
  }
  if (existing.role === "ADMIN") {
    throw new AppError("Cannot change status of an admin user", 400);
  }
  return prisma.user.update({
    where: { id },
    data: { status: status as never },
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
    },
  });
}
