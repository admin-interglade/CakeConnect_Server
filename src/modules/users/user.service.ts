import bcrypt from "bcryptjs";
import { prisma } from "../../prisma/index.js";
import {
  NotFoundError,
  ConflictError,
  AppError,
} from "../../common/AppError.js";
import { generateTempPassword, hashPassword, issueOwnerCredentials } from "../../common/credentials.js";
import { sendCredentialEmail } from "../../common/mailer.js";

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

  const role = (data.role as "ADMIN" | "SHOP_OWNER" | "SUPPORT_STAFF") || "SHOP_OWNER";

  let passwordHash: string | undefined;
  if (data.password) {
    passwordHash = await bcrypt.hash(data.password, 10);
  }

  const created = await prisma.user.create({
    data: {
      name: data.name,
      mobileNumber: data.mobileNumber,
      email: data.email,
      role,
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

  // A shop owner minted here has no password yet. Generate a one-time password,
  // email it with the sign-in facts, and force a change on first login. Admin
  // accounts (which set their own password at sign-up) are left untouched, and
  // an owner without an email cannot be reached, so no credentials exist for
  // them until the shop flow records one.
  if (role === "SHOP_OWNER" && data.email) {
    const tempPassword = await issueOwnerCredentials({
      email: data.email,
      mobileNumber: data.mobileNumber,
    });
    await prisma.user.update({
      where: { id: created.id },
      data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
    });
  }

  return created;
}

export async function createOwnerWithShops(data: {
  name: string;
  mobileNumber: string;
  email: string;
  shopIds: string[];
}) {
  const existing = await prisma.user.findUnique({
    where: { mobileNumber: data.mobileNumber },
  });
  if (existing) {
    throw new ConflictError("User with this mobile number already exists");
  }

  const shops = await prisma.shop.findMany({
    where: { id: { in: data.shopIds } },
    select: { id: true, ownerId: true, shopName: true, shopCode: true },
  });
  if (shops.length !== data.shopIds.length) {
    throw new NotFoundError("One or more shops were not found");
  }
  if (shops.some(shop => shop.ownerId)) {
    throw new ConflictError("One or more shops are already assigned to an owner");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        mobileNumber: data.mobileNumber,
        email: data.email,
        role: "SHOP_OWNER",
        passwordHash,
        mustChangePassword: true,
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

    for (const shop of shops) {
      const claimed = await tx.shop.updateMany({
        where: { id: shop.id, ownerId: null },
        data: { ownerId: user.id },
      });
      if (claimed.count !== 1) {
        throw new ConflictError("One or more shops were assigned during onboarding");
      }
      await tx.shopUser.create({
        data: { shopId: shop.id, userId: user.id, isPrimary: shop.id === shops[0].id },
      });
    }

    return { user, shops };
  });

  let inviteSent = false;
  let inviteError: string | undefined;
  try {
    inviteSent = await sendCredentialEmail({
      to: data.email,
      mobileNumber: data.mobileNumber,
      tempPassword,
      shopName: result.shops[0].shopName,
      shopCode: result.shops[0].shopCode,
    });
    if (!inviteSent) {
      inviteError = "SMTP is not configured; invitation was logged by the server instead";
    }
  } catch (error) {
    inviteError = error instanceof Error ? error.message : "Invitation email failed";
  }

  return { ...result, inviteSent, inviteError };
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
        // The admin's owner directory shows each owner with their outlets, so
        // the list carries the association rather than costing one read per row.
        shopUsers: {
          select: {
            shopId: true,
            isPrimary: true,
            shop: { select: { id: true, shopName: true, shopCode: true } },
          },
        },
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
    mobileNumber?: string;
    email?: string;
    role?: string;
    status?: string;
  },
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("User not found");
  }

  // Both are unique and the mobile number is the sign-in identifier, so a
  // clash is reported as a conflict rather than surfacing as a database error.
  if (data.mobileNumber && data.mobileNumber !== existing.mobileNumber) {
    const taken = await prisma.user.findUnique({
      where: { mobileNumber: data.mobileNumber },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictError("User with this mobile number already exists");
    }
  }
  if (data.email && data.email !== existing.email) {
    const taken = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictError("User with this email already exists");
    }
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.mobileNumber ? { mobileNumber: data.mobileNumber } : {}),
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
