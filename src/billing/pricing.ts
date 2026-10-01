export type Currency = 'TND' | 'EUR' | 'USD';

// EU member states plus the other euro users we are likely to see.
const EURO_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'MC',
  'AD',
  'SM',
  'VA',
  'ME',
  'XK',
]);

export function currencyForCountry(
  country: string | null | undefined,
): Currency {
  const code = (country ?? '').toUpperCase();
  if (code === 'TN') return 'TND';
  if (EURO_COUNTRIES.has(code)) return 'EUR';
  return 'USD';
}

export interface PriceTable {
  TND: number;
  EUR: number;
  USD: number;
}

export function priceTableFrom(
  env: (key: string) => string | undefined,
): PriceTable {
  const read = (key: string, fallback: number) => {
    const value = Number(env(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    TND: read('PRICE_TND', 35),
    EUR: read('PRICE_EUR', 12),
    USD: read('PRICE_USD', 12),
  };
}
