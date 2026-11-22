/** Formats a price for display, e.g. formatPrice(55.99, 'USD') gives "USD 55.99". */
export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
}
