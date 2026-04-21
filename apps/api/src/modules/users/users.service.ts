import { prisma } from '../../shared/lib/prisma';
import { NotFoundError } from '../../shared/utils/api-error';
import type { UpdateProfileInput, UserProfile } from '@comicstrunk/contracts';

// Safe select — excludes passwordHash and internal fields
const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  bio: true,
  websiteUrl: true,
  twitterHandle: true,
  instagramHandle: true,
  createdAt: true,
} as const;

export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}

const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
} as const;

export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_PROFILE_SELECT,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function updateProfile(
  userId: string,
  data: UpdateProfileInput,
): Promise<UserProfile> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.bio !== undefined && { bio: data.bio || null }),
      ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl || null }),
      ...(data.twitterHandle !== undefined && { twitterHandle: data.twitterHandle || null }),
      ...(data.instagramHandle !== undefined && { instagramHandle: data.instagramHandle || null }),
    },
    select: PROFILE_SELECT,
  });

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}
