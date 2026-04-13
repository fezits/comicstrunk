import { z } from 'zod';
import { type UserRole } from './common';

// === Password validation (reusable) ===
const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters');

// === Auth Schemas ===
export const signupSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: passwordSchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Must accept terms' }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

// === Inferred Input Types ===
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordRequestInput = z.infer<
  typeof resetPasswordRequestSchema
>;
export type ResetPasswordConfirmInput = z.infer<
  typeof resetPasswordConfirmSchema
>;

// === Response Interfaces ===
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}
