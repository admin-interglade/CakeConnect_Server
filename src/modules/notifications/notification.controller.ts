import type { Request, Response } from "express";
import * as notifService from "./notification.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, notifications, unreadCount } = await notifService.listNotifications(
    req.user!.userId,
    {
      page,
      limit,
      type: req.query.type as string | undefined,
      unreadOnly: req.query.unreadOnly === "true",
    },
  );
  const response = { notifications, unreadCount };
  return paginate(res, response, total, page, limit, "Notifications fetched");
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await notifService.markAsRead(req.params.id, req.user!.userId);
  return success(res, notification, "Notification marked as read");
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const result = await notifService.markAllAsRead(req.user!.userId);
  return success(res, result, "All notifications marked as read");
});

export const updatePreference = asyncHandler(async (req: Request, res: Response) => {
  const pref = await notifService.updatePreference(req.user!.userId, req.body);
  return success(res, pref, "Notification preference updated");
});

export const getPreferences = asyncHandler(async (req: Request, res: Response) => {
  const prefs = await notifService.getPreferences(req.user!.userId);
  return success(res, prefs, "Notification preferences fetched");
});