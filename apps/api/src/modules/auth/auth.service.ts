import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../../shared/lib/jwt';
import { logger } from '../../shared/lib/logger';
import { BadRequestError, ConflictError, UnauthorizedError } from '../../shared/utils/api-error';
import type { SignupInput, LoginInput, AuthUser } from '@comicstrunk/contracts';
import { createNotification } from '../notifications/notifications.service';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../notifications/email.service';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

// === Signup ===

export async function signup(input: SignupInput) {
  // Validate terms acceptance (AUTH-07)
  if (!input.acceptedTerms) {
    throw new BadRequestError('You must accept the terms of service');
  }

  // Check email uniqueness
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new ConflictError('Email already in use');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'USER',
      acceptedTermsAt: new Date(),
    },
  });

  // Generate token family
  const tokenFamily = crypto.randomUUID();

  // Sign tokens
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, tokenFamily });

  // Store refresh token hash
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      tokenFamily,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  // Fire-and-forget: send welcome notification and email
  createNotification({
    userId: user.id,
    type: 'WELCOME',
    title: 'Bem-vindo ao Comics Trunk!',
    message: 'Sua conta foi criada com sucesso. Comece explorando o catalogo e adicionando seus gibis a colecao!',
  }).catch(() => {});

  void sendWelcomeEmail(user.id, user.email, user.name);

  return { accessToken, refreshToken, user: authUser };
}

// === Login ===

export async function login(input: LoginInput) {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Compare password
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Generate new token family
  const tokenFamily = crypto.randomUUID();

  // Sign tokens
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, tokenFamily });

  // Store refresh token hash
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      tokenFamily,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return { accessToken, refreshToken, user: authUser };
}

// === Refresh Tokens ===

export async function refreshTokens(oldRefreshToken: string) {
  // Verify JWT
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Find matching non-revoked token
  const oldTokenHash = hashToken(oldRefreshToken);
  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash: oldTokenHash,
      revoked: false,
    },
  });

  if (!storedToken) {
    // Stolen token detection: revoke ALL tokens in this family
    await prisma.refreshToken.updateMany({
      where: { tokenFamily: payload.tokenFamily },
      data: { revoked: true },
    });
    logger.warn('Refresh token reuse detected — revoked token family', {
      tokenFamily: payload.tokenFamily,
      userId: payload.userId,
    });
    throw new UnauthorizedError('Token reuse detected — please log in again');
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  // Get user data for token signing and response
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Sign new tokens (same token family for rotation)
  const accessTokenFinal = signAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refreshToken = signRefreshToken({
    userId: user.id,
    tokenFamily: payload.tokenFamily,
  });

  // Store new refresh token hash
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      tokenFamily: payload.tokenFamily,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return { accessToken: accessTokenFinal, refreshToken, user: authUser };
}

// === Logout ===

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);

  // Find and revoke — idempotent (if not found, still success)
  const token = await prisma.refreshToken.findFirst({
    where: { tokenHash },
  });

  if (token) {
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: { revoked: true },
    });
  }
}

// === Request Password Reset ===

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success (do not reveal if email exists)
  if (!user) {
    return;
  }

  // Generate crypto-random token (32 bytes hex)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // Store hash in PasswordReset table with 1h TTL
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  // Send password reset email (fire-and-forget)
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';
  const resetLink = `${webUrl}/reset-password?token=${rawToken}`;

  logger.info(`Password reset link: ${resetLink}`);
  void sendPasswordResetEmail(user.email, { userName: user.name, resetLink });
}

// === Confirm Password Reset ===

export async function confirmPasswordReset(token: string, newPassword: string) {
  const tokenHash = hashToken(token);

  // Find valid (unused, not expired) reset record
  const resetRecord = await prisma.passwordReset.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetRecord) {
    throw new BadRequestError('Invalid or expired token');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update user password and mark reset as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    }),
    prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
    // Revoke all refresh tokens for this user (force re-login)
    prisma.refreshToken.updateMany({
      where: { userId: resetRecord.userId },
      data: { revoked: true },
    }),
  ]);
}
