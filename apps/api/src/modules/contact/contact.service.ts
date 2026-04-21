import { prisma } from '../../shared/lib/prisma';
import { NotFoundError } from '../../shared/utils/api-error';
import type { CreateContactMessageInput, ContactCategoryValue } from '@comicstrunk/contracts';
import type { ContactCategory } from '@prisma/client';

export async function submitMessage(data: CreateContactMessageInput) {
  const message = await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      category: data.category as ContactCategory,
      subject: data.subject,
      message: data.message,
    },
  });

  return message;
}

export async function listMessages(
  filters: {
    isRead?: boolean;
    isResolved?: boolean;
    category?: ContactCategoryValue;
  },
  pagination: { page: number; limit: number },
) {
  const where: Record<string, unknown> = {};

  if (filters.isRead !== undefined) {
    where.isRead = filters.isRead;
  }
  if (filters.isResolved !== undefined) {
    where.isResolved = filters.isResolved;
  }
  if (filters.category) {
    where.category = filters.category;
  }

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return { messages, total, page: pagination.page, limit: pagination.limit };
}

export async function getMessage(id: string) {
  const message = await prisma.contactMessage.findUnique({
    where: { id },
  });

  if (!message) {
    throw new NotFoundError('Mensagem de contato nao encontrada');
  }

  return message;
}

export async function markAsRead(id: string) {
  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Mensagem de contato nao encontrada');
  }

  const message = await prisma.contactMessage.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return message;
}

export async function markAsResolved(id: string) {
  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Mensagem de contato nao encontrada');
  }

  const message = await prisma.contactMessage.update({
    where: { id },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
    },
  });

  return message;
}

export async function deleteMessage(id: string) {
  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Mensagem de contato nao encontrada');
  }

  await prisma.contactMessage.delete({ where: { id } });
}
