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

/** Durations an owner can pay for, from PAYMENT_PLAN_MONTHS (e.g. "1,3,6,12"). */
export function plansFrom(
  pricePerMonth: number,
  monthsList: string | undefined,
): Plan[] {
  const months = (monthsList ?? '1,3,6,12')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 24);
  return [...new Set(months)]
    .sort((a, b) => a - b)
    .map((m) => ({
      months: m,
      amount: Math.round(pricePerMonth * m * 1000) / 1000,
    }));
}
