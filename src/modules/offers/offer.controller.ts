import type { Request, Response } from "express";
import * as offerService from "./offer.service.js";
import { asyncHandler } from "../../common/asyncHandler.js";
import { success, paginate, getPagination } from "../../common/response.js";
import { logAudit } from "../audit-logs/audit.service.js";

export const createOffer = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.createOffer(req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "OFFER_CREATED",
      entityType: "Offer",
      entityId: offer.id,
      newValue: offer,
    },
    req,
  );
  return success(res, offer, "Offer created", 201);
});

export const listOffers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const { total, offers } = await offerService.listOffers({
    page,
    limit,
    status: req.query.status as string | undefined,
    userRole: req.user?.role,
    shopIds: req.user?.shopIds,
  });
  return paginate(res, offers, total, page, limit, "Offers fetched");
});

export const getOffer = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.getOfferById(req.params.id, req.user?.role, req.user?.shopIds);
  return success(res, offer, "Offer fetched");
});

export const trackView = asyncHandler(async (req: Request, res: Response) => {
  const result = await offerService.trackOfferView(req.params.id);
  return success(res, result, "Offer view tracked");
});

export const updateOffer = asyncHandler(async (req: Request, res: Response) => {
  const before = await offerService.getOfferById(req.params.id, "ADMIN");
  const offer = await offerService.updateOffer(req.params.id, req.body);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "OFFER_UPDATED",
      entityType: "Offer",
      entityId: req.params.id,
      oldValue: before,
      newValue: offer,
    },
    req,
  );
  return success(res, offer, "Offer updated");
});

export const withdrawOffer = asyncHandler(async (req: Request, res: Response) => {
  const before = await offerService.getOfferById(req.params.id, "ADMIN");
  const offer = await offerService.withdrawOffer(req.params.id, req.body.reason);
  await logAudit(
    {
      actorId: req.user!.userId,
      action: "OFFER_WITHDRAWN",
      entityType: "Offer",
      entityId: req.params.id,
      oldValue: before,
      newValue: offer,
    },
    req,
  );
  return success(res, offer, "Offer withdrawn");
});