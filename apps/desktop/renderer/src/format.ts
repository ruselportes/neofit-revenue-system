const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });

export function formatPeso(amount: number): string {
  return peso.format(amount).replace('PHP', '₱').replace(/\s/g, '');
}

/** "2026-11-04" -> "Nov 4, 2026". Dates are parsed as local days, never through UTC. */
export function formatDate(date: string | null): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function monthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function todayText(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** The month before or after, wrapping over the year. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function percentText(value: number | null): string {
  if (value === null) return 'no earlier data';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
