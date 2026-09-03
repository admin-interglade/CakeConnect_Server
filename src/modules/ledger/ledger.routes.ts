import { Router } from "express";
import * as ctrl from "./ledger.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  listLedgerQuery,
  shopIdParams,
  adjustmentSchema,
  creditNoteSchema,
} from "./ledger.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";
import { z } from "zod";

export const ledgerRouter = Router();

ledgerRouter.use(authenticate);

ledgerRouter.get("/", validateQuery(listLedgerQuery), ctrl.listLedger);
ledgerRouter.get("/shops/:shopId/ledger", validateParams(shopIdParams), ctrl.getShopLedger);
ledgerRouter.get("/shops/:shopId/outstanding", validateParams(shopIdParams), ctrl.getOutstanding);

ledgerRouter.use(authorize("ADMIN"));
ledgerRouter.post("/adjustments", validateBody(adjustmentSchema), ctrl.addAdjustment);
ledgerRouter.post("/credit-notes", validateBody(creditNoteSchema), ctrl.addCreditNote);