import { Router } from "express";
import * as ctrl from "./notification.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  notificationIdParams,
  updatePreferenceSchema,
  listNotificationsQuery,
} from "./notification.validator.js";
import { authenticate } from "../../common/middleware/auth.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get("/", validateQuery(listNotificationsQuery), ctrl.listNotifications);
notificationRouter.patch("/read-all", ctrl.markAllAsRead);
notificationRouter.get("/preferences", ctrl.getPreferences);
notificationRouter.patch("/preferences", validateBody(updatePreferenceSchema), ctrl.updatePreference);
notificationRouter.patch("/:id/read", validateParams(notificationIdParams), ctrl.markAsRead);