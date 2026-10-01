import type { Subscription } from '@prisma/client';

export type EffectiveStatus =
  'trialing' | 'active' | 'past_due' | 'canceled' | 'none';

/**
 * The status the product acts on. A trial is only stored once; when it runs out
 * without a payment it reads as past_due, which is what sends the owner to
 * checkout instead of offering a second trial.
 */
export function effectiveStatus(
  subscription: Subscription | null,
  now = new Date(),
): EffectiveStatus {
  if (!subscription) return 'none';
  if (
    subscription.status === 'trialing' &&
    !subscription.paddleSubscriptionId
  ) {
    return subscription.trialEndsAt && subscription.trialEndsAt > now
      ? 'trialing'
      : 'past_due';
  }
  return subscription.status;
}

/** Whether the public menu is served. */
export function isMenuLive(
  subscription: Subscription | null,
  now = new Date(),
) {
  const status = effectiveStatus(subscription, now);
  return status === 'trialing' || status === 'active';
}
