import { type Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(
  res: Response,
  error: { message: string; code?: string; details?: unknown },
  statusCode = 500,
): void {
  const errorBody: Record<string, unknown> = {
    message: error.message,
  };
  if (error.code) {
    errorBody.code = error.code;
  }
  if (error.details) {
    errorBody.details = error.details;
  }
  res.status(statusCode).json({
    success: false,
    error: errorBody,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number },
): void {
  res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}
