import { prisma } from '../../shared/lib/prisma';
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/utils/api-error';
import type {
  CreateLegalDocumentInput,
  UpdateLegalDocumentInput,
  LegalDocumentType,
} from '@comicstrunk/contracts';
import type { LegalDocumentType as PrismaLegalDocumentType } from '@prisma/client';

// === Helper to cast contract enum to Prisma enum ===

function toPrismaType(type: LegalDocumentType): PrismaLegalDocumentType {
  return type as PrismaLegalDocumentType;
}

// === Admin: Create a new document (auto-increments version per type) ===

export async function createDocument(data: CreateLegalDocumentInput) {
  const latestVersion = await prisma.legalDocument.findFirst({
    where: { type: toPrismaType(data.type) },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  return prisma.legalDocument.create({
    data: {
      type: toPrismaType(data.type),
      version: nextVersion,
      content: data.content,
      dateOfEffect: data.dateOfEffect,
      isMandatory: data.isMandatory,
    },
  });
}

// === Public: Get the latest version of a document by type ===

export async function getLatestByType(type: LegalDocumentType) {
  const doc = await prisma.legalDocument.findFirst({
    where: { type: toPrismaType(type) },
    orderBy: { version: 'desc' },
  });

  if (!doc) {
    throw new NotFoundError('Documento legal nao encontrado para este tipo');
  }

  return doc;
}

// === Public: Get a specific document by ID ===

export async function getDocumentById(id: string) {
  const doc = await prisma.legalDocument.findUnique({
    where: { id },
  });

  if (!doc) {
    throw new NotFoundError('Documento legal nao encontrado');
  }

  return doc;
}

// === Admin: Get version history for a document type ===

export async function getDocumentHistory(type: LegalDocumentType) {
  return prisma.legalDocument.findMany({
    where: { type: toPrismaType(type) },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      type: true,
      version: true,
      dateOfEffect: true,
      isMandatory: true,
      createdAt: true,
    },
  });
}

// === Admin: List all documents (paginated, optional type filter) ===

export async function listDocuments(params: {
  page: number;
  limit: number;
  type?: LegalDocumentType;
}) {
  const { page, limit, type } = params;
  const skip = (page - 1) * limit;

  const where = type ? { type: toPrismaType(type) } : {};

  const [documents, total] = await Promise.all([
    prisma.legalDocument.findMany({
      where,
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.legalDocument.count({ where }),
  ]);

  return { documents, total, page, limit };
}

// === Admin: Update a document (only content, dateOfEffect, isMandatory) ===

export async function updateDocument(id: string, data: UpdateLegalDocumentInput) {
  const existing = await prisma.legalDocument.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('Documento legal nao encontrado');
  }

  return prisma.legalDocument.update({
    where: { id },
    data: {
      ...(data.content !== undefined && { content: data.content }),
      ...(data.dateOfEffect !== undefined && { dateOfEffect: data.dateOfEffect }),
      ...(data.isMandatory !== undefined && { isMandatory: data.isMandatory }),
    },
  });
}

// === Authenticated: Accept a document ===

export async function acceptDocument(
  userId: string,
  documentId: string,
  ipAddress: string,
) {
  const doc = await prisma.legalDocument.findUnique({ where: { id: documentId } });

  if (!doc) {
    throw new NotFoundError('Documento legal nao encontrado');
  }

  // Check if already accepted
  const existing = await prisma.legalAcceptance.findFirst({
    where: { userId, documentId },
  });

  if (existing) {
    throw new ConflictError('Voce ja aceitou este documento');
  }

  return prisma.legalAcceptance.create({
    data: {
      userId,
      documentId,
      acceptedAt: new Date(),
      ipAddress,
    },
  });
}

// === Authenticated: Check if user accepted latest mandatory version ===

export async function hasAcceptedLatest(
  userId: string,
  type: LegalDocumentType,
): Promise<boolean> {
  const latest = await prisma.legalDocument.findFirst({
    where: { type: toPrismaType(type), isMandatory: true },
    orderBy: { version: 'desc' },
    select: { id: true },
  });

  if (!latest) {
    // No mandatory document of this type exists — considered accepted
    return true;
  }

  const acceptance = await prisma.legalAcceptance.findFirst({
    where: { userId, documentId: latest.id },
  });

  return !!acceptance;
}

// === Authenticated: Get pending acceptances (mandatory docs not yet accepted) ===

export async function getPendingAcceptances(userId: string) {
  // Get all distinct mandatory document types
  const mandatoryTypes = await prisma.legalDocument.findMany({
    where: { isMandatory: true },
    distinct: ['type'],
    select: { type: true },
  });

  const pending = [];

  for (const { type } of mandatoryTypes) {
    const latest = await prisma.legalDocument.findFirst({
      where: { type, isMandatory: true },
      orderBy: { version: 'desc' },
    });

    if (!latest) continue;

    const acceptance = await prisma.legalAcceptance.findFirst({
      where: { userId, documentId: latest.id },
    });

    if (!acceptance) {
      pending.push(latest);
    }
  }

  return pending;
}

// === Authenticated: Get user's acceptance history (audit) ===

export async function getUserAcceptances(userId: string) {
  return prisma.legalAcceptance.findMany({
    where: { userId },
    include: {
      document: {
        select: {
          id: true,
          type: true,
          version: true,
          dateOfEffect: true,
          isMandatory: true,
        },
      },
    },
    orderBy: { acceptedAt: 'desc' },
  });
}
