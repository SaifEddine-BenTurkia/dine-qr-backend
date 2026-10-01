// TableQR is sold in Tunisia only for now, and paid in cash.
export const CURRENCY = 'TND';

export interface Plan {
  months: number;
  amount: number;
}

export interface PaymentContact {
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
}

export const DEFAULT_PLANS = '1:49,12:490';

/**
 * Plans an owner can pay for, from PAYMENT_PLANS: "months:price" pairs, e.g.
 * "1:49,12:490" (monthly, and a discounted year). An entry without a price
 * ("3") costs months × the monthly price.
 */
export function parsePlans(
  spec: string | undefined,
  pricePerMonth: number,
): Plan[] {
  const plans = new Map<number, number>();
  for (const entry of (spec?.trim() || DEFAULT_PLANS).split(',')) {
    const [monthsText, amountText] = entry
      .split(':')
      .map((part) => part.trim());
    const months = Number(monthsText);
    if (!Number.isInteger(months) || months < 1 || months > 24) continue;
    const amount =
      amountText === undefined ? pricePerMonth * months : Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    plans.set(months, Math.round(amount * 1000) / 1000);
  }
  return [...plans.entries()]
    .sort(([a], [b]) => a - b)
    .map(([months, amount]) => ({ months, amount }));
}
