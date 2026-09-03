import type { Request, Response, NextFunction } from "express";
import { AppError } from "../AppError.js";
import { error as errorResponse } from "../response.js";
import { logger } from "../logger.js";

export function notFound(req: Request, res: Response) {
  return errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode, err.errors);
  }

  logger.error(err);

  if (err instanceof SyntaxError) {
    return errorResponse(res, "Invalid JSON body", 400);
  }

  return errorResponse(res, "Internal Server Error", 500);
}
