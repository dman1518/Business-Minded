/**
 * Formats integer minor units (e.g. 29700) as a display price (e.g.
 * "$297.00"), matching the minor-units convention used throughout the
 * Clarity Session purchase model so nothing along the way ever
 * round-trips through a float.
 */
export function formatCurrency(amountMinorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinorUnits / 100);
}
