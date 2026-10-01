import type { Subscription } from '@prisma/client';

export type EffectiveStatus =
  'trialing' | 'active' | 'past_due' | 'canceled' | 'none';

/**
 * The status the product acts on. Stored rows only record what was granted
 * (a trial, or a paid period); whether it has run out is decided here, so no
 * scheduled job is needed to expire subscriptions. A trial or paid period
 * that has ended reads as past_due, which sends the owner to pay again.
 */
export function effectiveStatus(
  subscription: Subscription | null,
  now = new Date(),
): EffectiveStatus {
  if (!subscription) return 'none';
  switch (subscription.status) {
    case 'canceled':
      return 'canceled';
    case 'active':
      return subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd > now
        ? 'active'
        : 'past_due';
    case 'trialing':
      return subscription.trialEndsAt && subscription.trialEndsAt > now
        ? 'trialing'
        : 'past_due';
    default:
      return 'past_due';
  }
}

/** Whether the public menu is served. */
export function isMenuLive(
  subscription: Subscription | null,
  now = new Date(),
) {
  const status = effectiveStatus(subscription, now);
  return status === 'trialing' || status === 'active';
}

/**
 * Start of the period a new payment buys: paid time is added after whatever
 * the owner still has (remaining trial or paid period), never on top of
 * already-expired time.
 */
export function paidPeriodStart(
  subscription: Subscription | null,
  now = new Date(),
): Date {
  const candidates = [now.getTime()];
  if (subscription?.currentPeriodEnd && subscription.status === 'active') {
    candidates.push(subscription.currentPeriodEnd.getTime());
  }
  if (subscription?.trialEndsAt && subscription.status === 'trialing') {
    candidates.push(subscription.trialEndsAt.getTime());
  }
  return new Date(Math.max(...candidates));
}

/** Calendar months in UTC; Jan 31 + 1 month = Feb 28/29, not Mar 3. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
