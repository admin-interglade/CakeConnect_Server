import type { Request, Response } from "express";
import * as userService from "./user.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      newValue: user,
    },
    req,
  );
  return success(res, user, "User created", 201);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, users } = await userService.listUsers({
    page,
    limit,
    role: req.query.role as string | undefined,
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
  });
  return paginate(res, users, total, page, limit, "Users fetched");
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  return success(res, user, "User fetched");
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const before = await userService.getUserById(req.params.id);
  const user = await userService.updateUser(req.params.id, {
    name: req.body.name,
    mobileNumber: req.body.mobileNumber,
    email: req.body.email,
    role: req.body.role,
    status: req.body.status,
  });
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: user.id,
      oldValue: before,
      newValue: user,
    },
    req,
  );
  return success(res, user, "User updated");
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateProfile(req.user!.userId, req.body);
  return success(res, user, "Profile updated");
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  const before = await userService.getUserById(req.params.id);
  const user = await userService.setUserStatus(req.params.id, req.body.status);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: `USER_STATUS_${req.body.status}`,
      entityType: "User",
      entityId: user.id,
      oldValue: before,
      newValue: user,
    },
    req,
  );
  return success(res, user, "User status updated");
});

export const createOwner = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.createOwnerWithShops(req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "OWNER_CREATED_AND_ASSIGNED",
      entityType: "User",
      entityId: result.user.id,
      newValue: result,
    },
    req,
  );
  return success(res, result, "Shop owner created and invited", 201);
});