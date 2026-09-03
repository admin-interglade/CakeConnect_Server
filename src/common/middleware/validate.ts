import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";
import { error as errorResponse } from "../response.js";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        return errorResponse(res, "Validation failed", 400, errors);
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as Record<string, string>;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        return errorResponse(res, "Validation failed", 400, errors);
      }
      next(err);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        return errorResponse(res, "Validation failed", 400, errors);
      }
      next(err);
    }
  };
}
