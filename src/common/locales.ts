// Menu languages (PLAN section 5): French default, Arabic (RTL), English, and
// tourist languages. Owner-facing UI uses the first three.
export const SUPPORTED_LOCALES = ['fr', 'ar', 'en', 'de', 'it', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' &&
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

export type Translations = Partial<Record<Locale, string>>;

/**
 * Keeps only known locales with non-empty text, trimmed and capped. Returns
 * null when nothing is left, so "clear all translations" is an empty object.
 */
export function sanitizeTranslations(
  value: unknown,
  maxLength: number,
): Translations | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const out: Translations = {};
  for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
    if (!isLocale(key) || typeof text !== 'string') continue;
    const trimmed = text.trim().slice(0, maxLength);
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Next 05:00 in Africa/Tunis (UTC+1 all year, no daylight saving time). */
export function nextTunisFiveAm(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(4, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
