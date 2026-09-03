import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../../prisma/index.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { UnauthorizedError, ForbiddenError } from "../AppError.js";
import { asyncHandler } from "../asyncHandler.js";

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("Access token required");
    }

    const token = header.split(" ")[1];
    if (!token) {
      throw new UnauthorizedError("Access token required");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("User account is not active");
    }

    const shopUsers = await prisma.shopUser.findMany({
      where: { userId: user.id },
      select: { shopId: true },
    });
    const shopIds = shopUsers.map((s) => s.shopId);
    req.user = { userId: user.id, role: user.role, shopIds };

    next();
  },
);

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedError("Not authenticated");
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }
    next();
  };
}
