import multer, { type FileFilterCallback } from 'multer';
import type { Request, RequestHandler } from 'express';
import { BadRequestError } from '../utils/api-error';

const storage = multer.memoryStorage();

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CSV_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];
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
  const name = file.originalname.toLowerCase();
  const isValidExt = name.endsWith('.csv') || name.endsWith('.xlsx');

  if (isValidMime || isValidExt) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Apenas arquivos CSV ou XLSX são aceitos'));
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
