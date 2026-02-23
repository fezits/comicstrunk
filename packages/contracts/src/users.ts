import { z } from 'zod';
import { type UserRole } from './common';

// === User Profile Schema ===
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim()
    .optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  websiteUrl: z
    .string()
    .url('Must be a valid URL')
    .max(255, 'URL must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  twitterHandle: z
    .string()
    .max(50, 'Handle must be at most 50 characters')
    .transform((val) => val.replace(/^@/, ''))
    .optional(),
  instagramHandle: z
    .string()
    .max(50, 'Handle must be at most 50 characters')
    .transform((val) => val.replace(/^@/, ''))
    .optional(),
});

// === Inferred Input Type ===
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// === User Profile Interface ===
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  createdAt: string;
}
