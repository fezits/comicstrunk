import { prisma } from '../../shared/lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/utils/api-error';
import type { CreateCommentInput, UpdateCommentInput } from '@comicstrunk/contracts';

// === Standard user select for comment responses ===

const userSelect = {
  id: true,
  name: true,
  avatarUrl: true,
};

// === Create Comment ===

export async function createComment(userId: string, data: CreateCommentInput) {
  // Verify catalog entry exists and is APPROVED
  const catalogEntry = await prisma.catalogEntry.findUnique({
    where: { id: data.catalogEntryId },
  });

  if (!catalogEntry || catalogEntry.approvalStatus !== 'APPROVED') {
    throw new NotFoundError('Catalog entry not found or not approved');
  }

  // If parentId is provided, validate the reply
  if (data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: data.parentId },
    });

    if (!parent) {
      throw new NotFoundError('Parent comment not found');
    }

    // Verify parent belongs to same catalog entry
    if (parent.catalogEntryId !== data.catalogEntryId) {
      throw new BadRequestError('Parent comment does not belong to this catalog entry');
    }

    // Enforce one nesting level: reject if parent already has a parentId
    if (parent.parentId !== null) {
      throw new BadRequestError('Replies can only be one level deep');
    }
  }

  const comment = await prisma.comment.create({
    data: {
      userId,
      catalogEntryId: data.catalogEntryId,
      parentId: data.parentId || null,
      content: data.content,
    },
    include: {
      user: { select: userSelect },
    },
  });

  return comment;
}

// === Update Comment ===

export async function updateComment(userId: string, commentId: string, data: UpdateCommentInput) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== userId) {
    throw new ForbiddenError('You can only edit your own comments');
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content: data.content },
    include: {
      user: { select: userSelect },
    },
  });

  return updated;
}

// === Delete Comment ===

export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== userId) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  // Delete comment — Prisma cascade will remove likes.
  // For replies: delete child replies first, then the parent.
  await prisma.$transaction(async (tx) => {
    // Delete all replies of this comment (if it's a top-level comment)
    await tx.comment.deleteMany({
      where: { parentId: commentId },
    });

    // Delete the comment itself
    await tx.comment.delete({
      where: { id: commentId },
    });
  });
}

// === Get Catalog Comments (paginated, with nested replies) ===

export async function getCatalogComments(
  catalogEntryId: string,
  page: number,
  limit: number,
  currentUserId?: string,
) {
  const skip = (page - 1) * limit;

  // Fetch top-level comments (parentId IS NULL)
  const where = {
    catalogEntryId,
    parentId: null,
  };

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: userSelect },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: userSelect },
            ...(currentUserId
              ? {
                  likes: {
                    where: { userId: currentUserId },
                    select: { id: true },
                  },
                }
              : {}),
          },
        },
        ...(currentUserId
          ? {
              likes: {
                where: { userId: currentUserId },
                select: { id: true },
              },
            }
          : {}),
      },
    }),
    prisma.comment.count({ where }),
  ]);

  // Transform to add `isLiked` field
  const transformed = comments.map((comment) => ({
    id: comment.id,
    userId: comment.userId,
    catalogEntryId: comment.catalogEntryId,
    parentId: comment.parentId,
    content: comment.content,
    likesCount: comment.likesCount,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user,
    isLiked: currentUserId
      ? (comment as unknown as { likes?: { id: string }[] }).likes?.length
        ? true
        : false
      : false,
    replies: comment.replies.map((reply) => ({
      id: reply.id,
      userId: reply.userId,
      catalogEntryId: reply.catalogEntryId,
      parentId: reply.parentId,
      content: reply.content,
      likesCount: reply.likesCount,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      user: reply.user,
      isLiked: currentUserId
        ? (reply as unknown as { likes?: { id: string }[] }).likes?.length
          ? true
          : false
        : false,
    })),
  }));

  return { data: transformed, total, page, limit };
}

// === Toggle Comment Like ===

export async function toggleCommentLike(userId: string, commentId: string) {
  // Verify comment exists
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  // Check if already liked
  const existingLike = await prisma.commentLike.findUnique({
    where: {
      userId_commentId: { userId, commentId },
    },
  });

  if (existingLike) {
    // Unlike: remove like and decrement count
    await prisma.$transaction([
      prisma.commentLike.delete({
        where: { id: existingLike.id },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
      }),
    ]);

    return { liked: false, likesCount: comment.likesCount - 1 };
  } else {
    // Like: create like and increment count
    await prisma.$transaction([
      prisma.commentLike.create({
        data: { userId, commentId },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);

    return { liked: true, likesCount: comment.likesCount + 1 };
  }
}
