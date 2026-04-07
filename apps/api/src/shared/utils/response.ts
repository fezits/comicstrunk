import { type Response } from 'express';

// Fields hidden from API responses (internal sync fields)
const HIDDEN_FIELDS = ['sourceKey', 'source_key'];

function stripHiddenFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripHiddenFields);
  if (typeof obj === 'object' && obj !== null) {
    if (obj instanceof Date || obj instanceof Buffer) return obj;
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!HIDDEN_FIELDS.includes(key)) {
        cleaned[key] = stripHiddenFields(value);
      }
    }
    return cleaned;
  }
  return obj;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data: stripHiddenFields(data),
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
    data: stripHiddenFields(data),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}
