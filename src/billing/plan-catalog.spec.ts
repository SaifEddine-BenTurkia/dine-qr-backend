import { ENTITLEMENTS, TRIAL_DAYS, effectivePlan } from './plan-catalog';

describe('effectivePlan', () => {
  it('gives a new trial the Standard plan only', () => {
    const plan = effectivePlan({ plan: 'standard' });
    expect(plan).toBe('standard');
    expect(ENTITLEMENTS[plan].ordering).toBe(false);
    expect(ENTITLEMENTS[plan].stock).toBe(false);
  });

  it('keeps a paid or gifted plan', () => {
    expect(effectivePlan({ plan: 'premium' })).toBe('premium');
    expect(effectivePlan({ plan: 'business' })).toBe('business');
  });

  it('falls back to Standard without a subscription or with an unknown plan', () => {
    expect(effectivePlan(null)).toBe('standard');
    expect(effectivePlan({ plan: 'gold' })).toBe('standard');
  });

  it('runs the trial for 14 days', () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});
