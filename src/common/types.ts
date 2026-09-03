import type { Role } from "@prisma/client";

export interface AuthUser {
  userId: string;
  role: Role;
  shopAccess?: ShopAccess;
  shopIds?: string[];
}

export interface ShopAccess {
  shopIds: string[];
}

export {};
