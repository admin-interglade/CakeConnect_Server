import { Router } from "express";
import * as ctrl from "./cutoff.controller.js";
import {
  validateBody,
  validateParams,
} from "../../common/middleware/validate.js";
import {
  setGlobalCutoffSchema,
  setShopCutoffSchema,
  setDateCutoffSchema,
  addHolidaySchema,
  deleteHolidaySchema,
} from "./cutoff.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { z } from "zod";

const shopIdParams = z.object({ shopId: z.string().uuid() });

export const cutoffRouter = Router();

cutoffRouter.use(authenticate);

cutoffRouter.get("/global", ctrl.getGlobalCutoff);
cutoffRouter.get("/holidays", ctrl.listHolidays);
cutoffRouter.get("/shops/:shopId/effective", validateParams(shopIdParams), ctrl.getShopCutoff);

cutoffRouter.use(authorize("ADMIN"));
cutoffRouter.post("/global", validateBody(setGlobalCutoffSchema), ctrl.setGlobalCutoff);
cutoffRouter.post("/shops", validateBody(setShopCutoffSchema), ctrl.setShopCutoff);
cutoffRouter.post("/date", validateBody(setDateCutoffSchema), ctrl.setDateCutoff);
cutoffRouter.post("/holidays", validateBody(addHolidaySchema), ctrl.addHoliday);
cutoffRouter.delete("/holidays/:id", validateParams(deleteHolidaySchema), ctrl.deleteHoliday);