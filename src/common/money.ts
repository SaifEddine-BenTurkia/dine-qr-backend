/**
 * Money is stored and computed as integer millimes (1 DT = 1000 millimes),
 * never as floating-point dinars (P0-04). The API still speaks dinars as a
 * number with up to 3 decimals; these helpers are the only conversion points.
 */

export const MILLIMES_PER_DINAR = 1000;

/**
 * Parses a dinar amount into millimes: 12, 12.5, "12,500", "12.5", "12D500",
 * "12 DT", "12 000,500 DT". Returns null for anything else, including more
 * than 3 decimals or negative amounts.
 */
export function toMillimes(value: number | string): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    // Work on the decimal text, not on value * 1000, so 0.1 + 0.2 issues never apply.
    return toMillimes(value.toFixed(6).replace(/0+$/, '').replace(/\.$/, ''));
  }
  let text = value.trim().toUpperCase().replace(/\s+/g, '');
  text = text.replace(/(DT|TND|DINARS?)$/, '');
  let whole: string;
  let fraction = '';
  const d = /^(\d+)D(\d{0,3})$/.exec(text);
  if (d) {
    [, whole, fraction] = d;
    fraction = fraction.padEnd(3, '0');
  } else {
    const m = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(text);
    if (!m) return null;
    whole = m[1];
    fraction = (m[2] ?? '').padEnd(3, '0');
  }
  const result = Number(whole) * MILLIMES_PER_DINAR + Number(fraction || '0');
  return Number.isSafeInteger(result) ? result : null;
}

/** Same as toMillimes, but throws (for values already validated by a DTO). */
export function millimes(value: number | string): number {
  const result = toMillimes(value);
  if (result === null) throw new Error(`Invalid amount: ${String(value)}`);
  return result;
}

/** Dinars for API responses and display: 4500 → 4.5. */
export function fromMillimes(amount: number): number {
  return amount / MILLIMES_PER_DINAR;
}

export function sumMillimes(amounts: Iterable<number>): number {
  let total = 0;
  for (const amount of amounts) total += amount;
  return total;
}

/** A percentage of an amount, rounded half up to the millime: 20% of 4500 → 900. */
export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

/** "4,500 DT", "22 DT" (French style; millimes only when present). */
export function formatDinars(amount: number): string {
  const whole = Math.trunc(amount / MILLIMES_PER_DINAR);
  const rest = Math.abs(amount % MILLIMES_PER_DINAR);
  const wholeText = whole.toLocaleString('fr-FR').replace(/\s/g, ' ');
  return rest
    ? `${wholeText},${String(rest).padStart(3, '0')} DT`
    : `${wholeText} DT`;
}
