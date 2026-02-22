import multer, { type FileFilterCallback } from 'multer';
import type { Request, RequestHandler } from 'express';
import { BadRequestError } from '../utils/api-error';

const storage = multer.memoryStorage();

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CSV_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const CSV_MAX_SIZE = 10 * 1024 * 1024; // 10MB

function imageFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only JPEG, PNG, and WebP images are allowed'));
  }
}

function csvFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const isValidMime = CSV_MIME_TYPES.includes(file.mimetype);
  const isCSVExtension = file.originalname.toLowerCase().endsWith('.csv');

  if (isValidMime || isCSVExtension) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only CSV files are allowed'));
  }
}

export function uploadSingle(fieldName: string): RequestHandler {
  return multer({
    storage,
    limits: { fileSize: IMAGE_MAX_SIZE },
    fileFilter: imageFilter,
  }).single(fieldName);
}

export function uploadCSV(fieldName: string): RequestHandler {
  return multer({
    storage,
    limits: { fileSize: CSV_MAX_SIZE },
    fileFilter: csvFilter,
  }).single(fieldName);
}
