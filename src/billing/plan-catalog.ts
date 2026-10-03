import type { Subscription } from '@prisma/client';
import { effectiveStatus } from './subscription-status';

/**
 * The three plans (docs/ROADMAP.md). Standard replaces the paper menu,
 * Premium adds the service (calls, ordering, caisse, loyalty), Business adds
 * the management (counter sales, daily closing, stock and anti-waste).
 */
export const PLAN_IDS = ['standard', 'premium', 'business'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Entitlements {
  /** Menu languages the restaurant may offer; 'all' = every supported one. */
  locales: string[] | 'all';
  /** Waiter and bill calls, live staff board. */
  serviceCalls: boolean;
  /** Ordering from the table, caisse screen, ticket printing. */
  ordering: boolean;
  /** Loyalty card (Google Wallet). */
  loyalty: boolean;
  /** Staff members with a PIN; null = unlimited. */
  maxStaff: number | null;
  /** Counter sales on the caisse and the daily closing. */
  counterSales: boolean;
  /** Stock, expiry dates, anti-waste suggestions and promo prices. */
  stock: boolean;
}

export type Feature = Exclude<keyof Entitlements, 'locales' | 'maxStaff'>;

export const PLAN_NAMES: Record<PlanId, string> = {
  standard: 'Standard',
  premium: 'Premium',
  business: 'Business',
};

export const ENTITLEMENTS: Record<PlanId, Entitlements> = {
  standard: {
    locales: ['fr', 'ar'],
    serviceCalls: false,
    ordering: false,
    loyalty: false,
    maxStaff: 0,
    counterSales: false,
    stock: false,
  },
  premium: {
    locales: 'all',
    serviceCalls: true,
    ordering: true,
    loyalty: true,
    maxStaff: 5,
    counterSales: false,
    stock: false,
  },
  business: {
    locales: 'all',
    serviceCalls: true,
    ordering: true,
    loyalty: true,
    maxStaff: null,
    counterSales: true,
    stock: true,
  },
};

/** The cheapest plan that includes a feature, for "upgrade" messages. */
export function planFor(feature: Feature): PlanId {
  return PLAN_IDS.find((id) => ENTITLEMENTS[id][feature]) ?? 'business';
}

export function isPlanId(value: unknown): value is PlanId {
  return (PLAN_IDS as readonly unknown[]).includes(value);
}

/**
 * The plan the product acts on. During the free trial everything is unlocked
 * (the owner tries the whole product, then chooses); afterwards it is the plan
 * that was paid for.
 */
export function effectivePlan(
  subscription: Pick<
    Subscription,
    'status' | 'trialEndsAt' | 'currentPeriodEnd' | 'plan'
  > | null,
  now = new Date(),
): PlanId {
  if (!subscription) return 'standard';
  if (effectiveStatus(subscription as Subscription, now) === 'trialing') {
    return 'business';
  }
  return isPlanId(subscription.plan) ? subscription.plan : 'standard';
}

export interface PlanOffer {
  months: number;
  amount: number;
}

export interface PlanPrices {
  standard: number;
  premium: number;
  business: number;
}

/**
 * What each plan costs for the durations on sale. Standard keeps the prices
 * of PAYMENT_PLANS; the other plans follow the same durations: a year costs
 * 10 months, any other duration is months × the monthly price.
 */
export function buildCatalog(prices: PlanPrices, standardOffers: PlanOffer[]) {
  return PLAN_IDS.map((id) => ({
    id,
    name: PLAN_NAMES[id],
    pricePerMonth: prices[id],
    offers:
      id === 'standard'
        ? standardOffers
        : standardOffers.map(({ months }) => ({
            months,
            amount: months === 12 ? prices[id] * 10 : prices[id] * months,
          })),
    entitlements: ENTITLEMENTS[id],
  }));
}

export type Catalog = ReturnType<typeof buildCatalog>;
