import type { Subscription } from '@prisma/client';
import {
  addMonths,
  effectiveStatus,
  isMenuLive,
  paidPeriodStart,
} from './subscription-status';

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

  it('keeps a running trial live and expires it after the end date', () => {
    const running = subscription({
      trialEndsAt: new Date(now.getTime() + day),
    });
    const ended = subscription({ trialEndsAt: new Date(now.getTime() - day) });
    expect(effectiveStatus(running, now)).toBe('trialing');
    expect(isMenuLive(running, now)).toBe(true);
    expect(effectiveStatus(ended, now)).toBe('past_due');
    expect(isMenuLive(ended, now)).toBe(false);
  });

  it('keeps a paid period live until it ends', () => {
    const paid = subscription({
      status: 'active',
      currentPeriodEnd: new Date(now.getTime() + day),
    });
    const lapsed = subscription({
      status: 'active',
      currentPeriodEnd: new Date(now.getTime() - day),
    });
    expect(effectiveStatus(paid, now)).toBe('active');
    expect(effectiveStatus(lapsed, now)).toBe('past_due');
    expect(isMenuLive(lapsed, now)).toBe(false);
  });

  it('treats canceled as off', () => {
    expect(isMenuLive(subscription({ status: 'canceled' }), now)).toBe(false);
  });
});

describe('paidPeriodStart', () => {
  it('starts now when nothing is left', () => {
    expect(paidPeriodStart(null, now)).toEqual(now);
    expect(
      paidPeriodStart(
        subscription({
          status: 'active',
          currentPeriodEnd: new Date(now.getTime() - day),
        }),
        now,
      ),
    ).toEqual(now);
  });

  it('starts after the remaining trial or paid period', () => {
    const trialEnd = new Date(now.getTime() + 10 * day);
    expect(
      paidPeriodStart(subscription({ trialEndsAt: trialEnd }), now),
    ).toEqual(trialEnd);
    const periodEnd = new Date(now.getTime() + 20 * day);
    expect(
      paidPeriodStart(
        subscription({ status: 'active', currentPeriodEnd: periodEnd }),
        now,
      ),
    ).toEqual(periodEnd);
  });
});

describe('addMonths', () => {
  it('adds calendar months', () => {
    expect(addMonths(new Date('2026-10-01T12:00:00Z'), 3).toISOString()).toBe(
      '2027-01-01T12:00:00.000Z',
    );
  });

  it('clamps to the end of shorter months', () => {
    expect(addMonths(new Date('2027-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
  });
});
