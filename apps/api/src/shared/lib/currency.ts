/**
 * Rounds a monetary amount to 2 decimal places using banker's rounding.
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
