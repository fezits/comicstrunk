import crypto from 'crypto';

/**
 * Generates a unique order number in the format: ORD-YYYYMMDD-XXXXXX
 * The 6-char suffix is a random hex string from crypto.randomBytes.
 */
export function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${datePart}-${suffix}`;
}
