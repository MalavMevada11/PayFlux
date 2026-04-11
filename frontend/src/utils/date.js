/**
 * Format an ISO date string (YYYY-MM-DD) to DD/MM/YYYY for display.
 * Returns empty string for falsy input.
 */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
