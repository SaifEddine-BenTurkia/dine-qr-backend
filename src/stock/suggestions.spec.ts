import { buildSuggestions, promoPrice, type DishSnapshot } from './suggestions';

// 18:00 in Tunis; the service day ends at 05:00 the next morning.
const now = new Date('2026-10-03T17:00:00Z');
const endOfDay = new Date('2026-10-04T04:00:00Z');
const ctx = { now, endOfDay, daysObserved: 14 };

const dish = (overrides: Partial<DishSnapshot>): DishSnapshot => ({
  id: 'd1',
  name: 'Croissant',
  tracked: true,
  stockQty: 0,
  batches: [],
  sold14: 0,
  lateShare: 0.4,
  promoActive: false,
  ...overrides,
});

describe('anti-waste suggestions', () => {
  it('suggests a promo when stock expires faster than it sells', () => {
    const [s] = buildSuggestions(
      [
        dish({
          stockQty: 12,
          batches: [{ remaining: 12, expiresAt: endOfDay }],
          sold14: 140, // 10 a day, 4 of them from now to closing
        }),
      ],
      ctx,
    );
    expect(s).toMatchObject({
      kind: 'promo',
      title: '12 × Croissant à vendre avant ce soir',
      action: { type: 'promo', percent: 30, until: endOfDay.toISOString() },
    });
    expect(s.detail).toContain('environ 4');
    expect(s.detail).toContain('les 8 restants');
  });

  it('cuts deeper when almost nothing will sell, and says nothing when it will sell', () => {
    const noHistory = buildSuggestions(
      [dish({ stockQty: 6, batches: [{ remaining: 6, expiresAt: endOfDay }] })],
      ctx,
    );
    expect(noHistory[0].action).toMatchObject({ percent: 50 });

    const sellsOut = buildSuggestions(
      [
        dish({
          stockQty: 5,
          batches: [{ remaining: 5, expiresAt: endOfDay }],
          sold14: 280, // 20 a day, 8 before closing
        }),
      ],
      ctx,
    );
    expect(sellsOut.filter((s) => s.kind === 'promo')).toHaveLength(0);
  });

  it('counts tomorrow for stock that expires tomorrow, and skips running promos', () => {
    const tomorrow = new Date(endOfDay.getTime() + 24 * 60 * 60 * 1000);
    const [s] = buildSuggestions(
      [
        dish({
          stockQty: 30,
          batches: [{ remaining: 30, expiresAt: tomorrow }],
          sold14: 140, // 4 tonight + 10 tomorrow = 14 expected
        }),
      ],
      ctx,
    );
    expect(s.title).toBe('30 × Croissant à vendre avant demain soir');
    expect(s.detail).toContain('environ 14');
    expect(s.action).toMatchObject({ percent: 30 });

    expect(
      buildSuggestions(
        [
          dish({
            stockQty: 12,
            batches: [{ remaining: 12, expiresAt: endOfDay }],
            promoActive: true,
          }),
        ],
        ctx,
      ),
    ).toHaveLength(0);
  });

  it('warns when the stock will not last until closing', () => {
    const [s] = buildSuggestions(
      [
        dish({
          name: 'Brik',
          stockQty: 2,
          sold14: 140,
          batches: [{ remaining: 2, expiresAt: null }],
        }),
      ],
      ctx,
    );
    expect(s).toMatchObject({
      kind: 'restock',
      title: 'Brik : il en reste 2',
    });
    expect(s.action).toBeUndefined();
  });

  it('points at dishes nobody orders, only with enough history', () => {
    const menu = [
      dish({ id: 'a', name: 'Café', tracked: false, sold14: 200 }),
      dish({ id: 'b', name: 'Tajine', tracked: false, sold14: 0 }),
    ];
    const found = buildSuggestions(menu, ctx);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      kind: 'slow',
      dishId: 'b',
      action: { type: 'promo', percent: 20 },
    });
    expect(buildSuggestions(menu, { ...ctx, daysObserved: 3 })).toHaveLength(0);
  });
});

describe('promoPrice', () => {
  it('rounds down to 100 millimes and never reaches 0', () => {
    expect(promoPrice(4500, 20)).toBe(3600);
    expect(promoPrice(2800, 30)).toBe(1900); // 1960 → 1900
    expect(promoPrice(1500, 50)).toBe(700); // 750 → 700
    expect(promoPrice(150, 90)).toBe(100);
  });
});
