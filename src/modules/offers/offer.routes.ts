import { Router } from "express";
import * as ctrl from "./offer.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../common/middleware/validate.js";
import {
  createOfferSchema,
  updateOfferSchema,
  offerIdParams,
  withdrawOfferSchema,
  listOffersQuery,
} from "./offer.validator.js";
import { authenticate, authorize } from "../../common/middleware/auth.js";

export const offerRouter = Router();

offerRouter.use(authenticate);

offerRouter.get("/", validateQuery(listOffersQuery), ctrl.listOffers);
offerRouter.get("/:id/view", validateParams(offerIdParams), ctrl.trackView);
offerRouter.get("/:id", validateParams(offerIdParams), ctrl.getOffer);

offerRouter.use(authorize("ADMIN"));
offerRouter.post("/", validateBody(createOfferSchema), ctrl.createOffer);
offerRouter.patch("/:id", validateParams(offerIdParams), validateBody(updateOfferSchema), ctrl.updateOffer);
offerRouter.post("/:id/withdraw", validateParams(offerIdParams), validateBody(withdrawOfferSchema), ctrl.withdrawOffer);