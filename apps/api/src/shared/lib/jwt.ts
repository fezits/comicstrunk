import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Validate secrets on module load — asserting type after runtime guard
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

const JWT_ACCESS_SECRET: string = requireEnv('JWT_ACCESS_SECRET');
const JWT_REFRESH_SECRET: string = requireEnv('JWT_REFRESH_SECRET');

// === Types ===

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenFamily: string;
}

// === Sign helpers ===

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

// === Verify helpers ===

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
  });
  return decoded as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
  });
  return decoded as unknown as RefreshTokenPayload;
}

// === Hash helper ===

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
