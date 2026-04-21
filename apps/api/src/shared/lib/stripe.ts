import Stripe from 'stripe';

// === Stripe SDK Client ===

const secretKey = process.env.STRIPE_SECRET_KEY;

/**
 * Stripe SDK client instance.
 * Only available when STRIPE_SECRET_KEY is configured.
 */
export const stripe = secretKey
  ? new Stripe(secretKey, { apiVersion: '2026-02-25.clover' })
  : null;

/**
 * Check if Stripe is configured (secret key is set).
 */
export function isStripeConfigured(): boolean {
  return !!secretKey;
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 *
 * In dev mode (STRIPE_WEBHOOK_SECRET not set), the raw body is parsed
 * directly as JSON without signature verification and a warning is logged.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Dev mode: skip signature verification, parse raw body directly
    console.warn(
      '[Stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev mode)',
    );
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    return JSON.parse(body) as Stripe.Event;
  }

  if (!stripe) {
    throw new Error('Stripe client not initialized (STRIPE_SECRET_KEY missing)');
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
