import type { Subscription } from '@prisma/client';
import { effectiveStatus, isMenuLive } from './subscription-status';

const now = new Date('2026-10-01T12:00:00Z');
const day = 24 * 60 * 60 * 1000;

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: 's',
    userId: 'u',
    status: 'trialing',
    currency: 'TND',
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    paddleCustomerId: null,
    paddleSubscriptionId: null,
    paddleUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('effectiveStatus', () => {
  it('is none without a subscription', () => {
    expect(effectiveStatus(null, now)).toBe('none');
    expect(isMenuLive(null, now)).toBe(false);
  });

  it('keeps a running trial live', () => {
    const sub = subscription({ trialEndsAt: new Date(now.getTime() + day) });
    expect(effectiveStatus(sub, now)).toBe('trialing');
    expect(isMenuLive(sub, now)).toBe(true);
  });

  it('turns an expired local trial into past_due', () => {
    const sub = subscription({ trialEndsAt: new Date(now.getTime() - day) });
    expect(effectiveStatus(sub, now)).toBe('past_due');
    expect(isMenuLive(sub, now)).toBe(false);
  });

  it('trusts Paddle for paid subscriptions', () => {
    expect(
      effectiveStatus(
        subscription({ status: 'active', paddleSubscriptionId: 'sub_1' }),
        now,
      ),
    ).toBe('active');
    expect(
      isMenuLive(
        subscription({ status: 'canceled', paddleSubscriptionId: 'sub_1' }),
        now,
      ),
    ).toBe(false);
  });
});
