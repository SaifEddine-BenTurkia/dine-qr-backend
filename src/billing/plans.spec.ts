import { DEFAULT_PLANS, parsePlans } from './plans';

describe('parsePlans', () => {
  it('reads explicit prices, sorted by duration', () => {
    expect(parsePlans('12:490, 1:49', 49)).toEqual([
      { months: 1, amount: 49 },
      { months: 12, amount: 490 },
    ]);
  });

  it('prices entries without an amount at the monthly rate', () => {
    expect(parsePlans('1,3', 49)).toEqual([
      { months: 1, amount: 49 },
      { months: 3, amount: 147 },
    ]);
  });

  it('falls back to the default plans when unset', () => {
    expect(parsePlans(undefined, 49)).toEqual(parsePlans(DEFAULT_PLANS, 49));
    expect(parsePlans('', 49)).toEqual([
      { months: 1, amount: 49 },
      { months: 12, amount: 490 },
    ]);
  });

  it('ignores malformed entries', () => {
    expect(parsePlans('0:10,abc,30:1,6:-5,2:98', 49)).toEqual([
      { months: 2, amount: 98 },
    ]);
  });
});
