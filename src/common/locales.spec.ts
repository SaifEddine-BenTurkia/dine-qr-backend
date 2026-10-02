import { nextTunisFiveAm, sanitizeTranslations } from './locales';

describe('sanitizeTranslations', () => {
  it('keeps known locales with text, trimmed and capped', () => {
    expect(
      sanitizeTranslations({ en: '  Brik ', ar: '', xx: 'no', de: 5 }, 3),
    ).toEqual({ en: 'Bri' });
  });

  it('clears with an empty object and ignores missing values', () => {
    expect(sanitizeTranslations({}, 10)).toBeNull();
    expect(sanitizeTranslations(undefined, 10)).toBeUndefined();
    expect(sanitizeTranslations('text', 10)).toBeNull();
  });
});

describe('nextTunisFiveAm', () => {
  it('is 05:00 Tunis time (04:00 UTC) later today or tomorrow', () => {
    expect(
      nextTunisFiveAm(new Date('2026-10-03T02:00:00Z')).toISOString(),
    ).toBe('2026-10-03T04:00:00.000Z');
    expect(
      nextTunisFiveAm(new Date('2026-10-03T21:30:00Z')).toISOString(),
    ).toBe('2026-10-04T04:00:00.000Z');
  });
});
