import { prisma } from "../../prisma/index.js";
import {
  NotFoundError,
  ConflictError,
  AppError,
} from "../../common/AppError.js";
import type { AuthUser } from "../../common/types.js";
import { hashPassword, issueOwnerCredentials } from "../../common/credentials.js";

function generateShopCode(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4);
  return `${clean}${Date.now().toString().slice(-4)}`;
}

export async function createShop(data: {
  shopCode?: string;
  shopName: string;
  ownerMobileNumber?: string;
  ownerName?: string;
  ownerEmail?: string;
  mobileNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  creditLimit?: number;
  priceListId?: string;
}) {
  const existing = await prisma.shop.findUnique({
    where: { shopCode: data.shopCode || "" },
  });
  if (existing) {
    throw new ConflictError("Shop code already exists");
  }

  const shopCode = data.shopCode || generateShopCode(data.shopName);

  let ownerId: string | undefined;
  let provisionNewOwner = false;
  if (data.ownerMobileNumber) {
    let owner = await prisma.user.findUnique({
      where: { mobileNumber: data.ownerMobileNumber },
    });
    if (!owner) {
      owner = await prisma.user.create({
        data: {
          name: data.ownerName || "Shop Owner",
          mobileNumber: data.ownerMobileNumber,
          email: data.ownerEmail,
          role: "SHOP_OWNER",
        },
      });
      provisionNewOwner = true;
    }
    ownerId = owner.id;
  }

  const shop = await prisma.shop.create({
    data: {
      shopCode,
      shopName: data.shopName,
      ownerId,
      mobileNumber: data.mobileNumber,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      gstin: data.gstin,
      creditLimit: data.creditLimit ?? 0,
    },
    include: {
      owner: { select: { id: true, name: true, mobileNumber: true } },
      shopUsers: { include: { user: { select: { id: true, name: true, mobileNumber: true } } } },
    },
  });

  if (ownerId) {
    await prisma.shopUser.create({
      data: { shopId: shop.id, userId: ownerId, isPrimary: true },
    });
  }

  // An owner who never received sign-in credentials gets a one-time password
  // emailed now: either they are brand new (provisionNewOwner) or they were
  // created before the mail flow existed and still have no password.
  if (ownerId && data.ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true, passwordHash: true },
    });
    const needsCredentials = provisionNewOwner || !owner?.passwordHash;
    if (owner && needsCredentials) {
      const tempPassword = await issueOwnerCredentials({
        email: data.ownerEmail,
        mobileNumber: data.ownerMobileNumber!,
        shopName: data.shopName,
        shopCode,
      });
      await prisma.user.update({
        where: { id: ownerId },
        data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
      });
    }
  }

  if (data.priceListId) {
    await prisma.shopPriceList.create({
      data: { shopId: shop.id, priceListId: data.priceListId },
    });
  }

  return prisma.shop.findUnique({
    where: { id: shop.id },
    include: {
      owner: { select: { id: true, name: true, mobileNumber: true } },
      shopUsers: { include: { user: { select: { id: true, name: true, mobileNumber: true } } } },
      priceListAssociations: { include: { priceList: true } },
    },
  });
}

export async function listShops(query: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  city?: string;
  user?: AuthUser;
}) {
  const where: Record<string, unknown> = {
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.city ? { city: query.city } : {}),
    ...(query.search
      ? {
          OR: [
            { shopName: { contains: query.search, mode: "insensitive" as const } },
            { shopCode: { contains: query.search, mode: "insensitive" as const } },
            { mobileNumber: { contains: query.search } },
          ],
        }
      : {}),
  };

  if (query.user && query.user.role === "SHOP_OWNER") {
    where.id = { in: query.user.shopIds ?? [] };
  }

  const [total, shops] = await prisma.$transaction([
    prisma.shop.count({ where }),
    prisma.shop.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        shopCode: true,
        shopName: true,
        ownerId: true,
        mobileNumber: true,
        email: true,
        city: true,
        state: true,
        creditLimit: true,
        currentOutstanding: true,
        status: true,
        createdAt: true,
        owner: { select: { id: true, name: true, mobileNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { total, shops };
}

export async function getShopById(id: string, user?: AuthUser) {
  if (user && user.role === "SHOP_OWNER") {
    const access = user.shopIds?.includes(id);
    if (!access) {
      throw new AppError("You do not have access to this shop", 403);
    }
  }

  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, mobileNumber: true, email: true } },
      shopUsers: {
        include: { user: { select: { id: true, name: true, mobileNumber: true } } },
      },
      priceListAssociations: { include: { priceList: { include: { items: true } } } },
    },
  });

  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  const availableCredit = Number(shop.creditLimit) - Number(shop.currentOutstanding);
  return { ...shop, availableCredit };
}

export async function updateShop(
  id: string,
  data: {
    shopName?: string;
    mobileNumber?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
  },
  user?: AuthUser,
) {
  if (user && user.role === "SHOP_OWNER") {
    const access = user.shopIds?.includes(id);
    if (!access) {
      throw new AppError("You do not have access to this shop", 403);
    }
  }

  const existing = await prisma.shop.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Shop not found");
  }

  return prisma.shop.update({
    where: { id },
    data,
    select: {
      id: true,
      shopCode: true,
      shopName: true,
      email: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      gstin: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function setShopStatus(id: string, status: string) {
  const existing = await prisma.shop.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Shop not found");
  }
  return prisma.shop.update({
    where: { id },
    data: { status: status as never },
    select: {
      id: true,
      shopCode: true,
      shopName: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function deleteShop(id: string) {
  const existing = await prisma.shop.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Shop not found");
  }
  // Soft-delete by setting status to INACTIVE instead of hard delete.
  return prisma.shop.update({
    where: { id },
    data: { status: "INACTIVE" },
    select: { id: true, shopCode: true, shopName: true, status: true },
  });
}

export async function setCreditLimit(id: string, data: { creditLimit: number; creditBehavior?: string }) {
  const existing = await prisma.shop.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Shop not found");
  }
  return prisma.shop.update({
    where: { id },
    data: {
      creditLimit: data.creditLimit,
      ...(data.creditBehavior ? { creditBehavior: data.creditBehavior } : {}),
    },
    select: {
      id: true,
      shopCode: true,
      shopName: true,
      creditLimit: true,
      creditBehavior: true,
      currentOutstanding: true,
    },
  });
}

export async function assignShopOwner(id: string, userId: string) {
  const shop = await prisma.shop.findUnique({ where: { id } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const existingAssociation = await prisma.shopUser.findUnique({
    where: { shopId_userId: { shopId: id, userId } },
  });
  if (!existingAssociation) {
    await prisma.shopUser.create({
      data: { shopId: id, userId, isPrimary: true },
    });
  }

  return prisma.shop.update({
    where: { id },
    data: { ownerId: userId },
    select: {
      id: true,
      shopCode: true,
      shopName: true,
      ownerId: true,
      shopUsers: true,
    },
  });
}

export async function assignPriceList(id: string, priceListId: string) {
  const shop = await prisma.shop.findUnique({ where: { id } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }
  const priceList = await prisma.priceList.findUnique({ where: { id: priceListId } });
  if (!priceList) {
    throw new NotFoundError("Price list not found");
  }

  const existing = await prisma.shopPriceList.findUnique({
    where: { shopId_priceListId: { shopId: id, priceListId } },
  });
  if (!existing) {
    await prisma.shopPriceList.create({
      data: { shopId: id, priceListId },
    });
  }

  return prisma.shop.findUnique({
    where: { id },
    include: {
      priceListAssociations: { include: { priceList: true } },
    },
  });
}