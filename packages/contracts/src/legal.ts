import { z } from 'zod';
import { paginationSchema } from './common';

// === Enums ===

export const legalDocumentTypeEnum = z.enum([
  'TERMS_OF_USE',
  'PRIVACY_POLICY',
  'SELLER_TERMS',
  'PAYMENT_POLICY',
  'RETURNS_POLICY',
  'SHIPPING_POLICY',
  'CANCELLATION_POLICY',
  'COOKIES_POLICY',
]);

// === Schemas ===

export const createLegalDocumentSchema = z.object({
  type: legalDocumentTypeEnum,
  content: z.string().min(10, 'Conteudo deve ter no minimo 10 caracteres'),
  dateOfEffect: z.coerce.date({ required_error: 'Data de vigencia e obrigatoria' }),
  isMandatory: z.boolean().default(false),
});

export const updateLegalDocumentSchema = z.object({
  content: z.string().min(10, 'Conteudo deve ter no minimo 10 caracteres').optional(),
  dateOfEffect: z.coerce.date().optional(),
  isMandatory: z.boolean().optional(),
});

export const acceptDocumentSchema = z.object({
  documentId: z.string().min(1, 'ID do documento e obrigatorio'),
});

export const listLegalDocumentsSchema = paginationSchema.extend({
  type: legalDocumentTypeEnum.optional(),
});

// === Types ===

export type LegalDocumentType = z.infer<typeof legalDocumentTypeEnum>;
export type CreateLegalDocumentInput = z.infer<typeof createLegalDocumentSchema>;
export type UpdateLegalDocumentInput = z.infer<typeof updateLegalDocumentSchema>;
export type AcceptDocumentInput = z.infer<typeof acceptDocumentSchema>;
export type ListLegalDocumentsInput = z.infer<typeof listLegalDocumentsSchema>;
