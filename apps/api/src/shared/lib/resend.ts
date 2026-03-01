import { Resend } from 'resend';

// === Resend SDK Client ===

const apiKey = process.env.RESEND_API_KEY;

/**
 * Resend SDK client instance.
 * Only available when RESEND_API_KEY is configured.
 */
export const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Check if Resend is configured (API key is set).
 */
export function isResendConfigured(): boolean {
  return !!apiKey;
}

/**
 * Default "from" address for transactional emails.
 * Can be overridden via RESEND_FROM_EMAIL env var.
 */
export const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'Comics Trunk <noreply@comicstrunk.com.br>';
