import { Router } from "express";
import * as ctrl from "./user.controller.js";
import { validateBody, validateParams } from "../../common/middleware/validate.js";
import {
  createUserSchema,
  updateProfileSchema,
  updateUserSchema,
  statusSchema,
  userIdParams,
} from "./user.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.post("/", authorize("ADMIN"), validateBody(createUserSchema), ctrl.createUser);
userRouter.get("/", authorize("ADMIN", "SUPPORT_STAFF"), ctrl.listUsers);
userRouter.patch("/profile", validateBody(updateProfileSchema), ctrl.updateProfile);
userRouter.get("/:id", authorize("ADMIN", "SUPPORT_STAFF"), validateParams(userIdParams), ctrl.getUser);
userRouter.patch("/:id", authorize("ADMIN"), validateParams(userIdParams), validateBody(updateUserSchema), ctrl.updateUser);
userRouter.patch("/:id/status", authorize("ADMIN"), validateParams(userIdParams), validateBody(statusSchema), ctrl.setStatus);