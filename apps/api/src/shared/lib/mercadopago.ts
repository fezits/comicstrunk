import crypto from 'crypto';
import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';

// === Mercado Pago SDK Client ===

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

const mpClient = accessToken
  ? new MercadoPagoConfig({
      accessToken,
      options: { timeout: 10000 },
    })
  : null;

/**
 * Mercado Pago Payment API instance.
 * Only available when MERCADOPAGO_ACCESS_TOKEN is configured.
 */
export const mpPayment = mpClient ? new Payment(mpClient) : null;

/**
 * Mercado Pago PaymentRefund API instance.
 * Only available when MERCADOPAGO_ACCESS_TOKEN is configured.
 */
export const mpRefund = mpClient ? new PaymentRefund(mpClient) : null;

/**
 * Check if Mercado Pago is configured (access token is set).
 */
export function isMercadoPagoConfigured(): boolean {
  return !!accessToken;
}

/**
 * Validate the webhook signature from Mercado Pago.
 *
 * The x-signature header contains `ts=<timestamp>,v1=<hmac>`.
 * The template for HMAC computation is: `id:<dataId>;request-id:<xRequestId>;ts:<ts>;`
 *
 * Returns false gracefully if MERCADOPAGO_WEBHOOK_SECRET is not set (skip validation in dev).
 */
export function validateWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
): boolean {
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Skip validation in dev when secret is not configured
    return true;
  }

  // Parse ts and v1 from x-signature header
  const parts = xSignature.split(',');
  const tsValue = parts
    .find((p) => p.trim().startsWith('ts='))
    ?.split('=')[1];
  const v1Value = parts
    .find((p) => p.trim().startsWith('v1='))
    ?.split('=')[1];

  if (!tsValue || !v1Value) {
    return false;
  }

  // Build template string
  const template = `id:${dataId};request-id:${xRequestId};ts:${tsValue};`;

  // Compute HMAC-SHA256
  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(template)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(v1Value, 'hex'),
    );
  } catch {
    // Buffer length mismatch means invalid signature
    return false;
  }
}
