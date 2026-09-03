import type { Response } from "express";

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function success<T>(
  res: Response,
  data: T,
  message = "Operation completed successfully",
  statusCode = 200,
  meta?: ApiResponse<T>["meta"],
): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  if (meta) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
}

export function error(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown[],
): Response {
  const body: ApiResponse<never> = { success: false, message };
  if (errors) {
    body.errors = errors;
  }
  return res.status(statusCode).json(body);
}

export function paginate(
  res: Response,
  data: unknown,
  total: number,
  page: number,
  limit: number,
  message = "Operation completed successfully",
): Response {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return success(res, data, message, 200, { page, limit, total, totalPages });
}

export function getPagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
