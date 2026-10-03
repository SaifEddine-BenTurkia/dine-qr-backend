/**
 * Anti-waste suggestions (S-04). Plain rules on stock, expiry and the last
 * 14 days of sales, so every suggestion can be explained to the owner and
 * tested. No AI involved.
 */

export interface DishSnapshot {
  id: string;
  name: string;
  tracked: boolean;
  stockQty: number;
  batches: { remaining: number; expiresAt: Date | null }[];
  /** Units sold in the last 14 days. */
  sold14: number;
  /** Share of this dish's sales that happen between "now" and closing (0–1). */
  lateShare: number;
  promoActive: boolean;
}

export interface Suggestion {
  id: string;
  kind: 'promo' | 'restock' | 'slow';
  dishId: string;
  dishName: string;
  title: string;
  detail: string;
  /** One tap applies it. */
  action?: { type: 'promo'; percent: number; until: string };
}

export interface SuggestionContext {
  now: Date;
  /** End of the current service day (05:00 Tunis). */
  endOfDay: Date;
  /** Days with sales history, 1 to 14. */
  daysObserved: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function whenLabel(date: Date, ctx: SuggestionContext) {
  if (date <= ctx.endOfDay) return 'ce soir';
  if (date.getTime() <= ctx.endOfDay.getTime() + DAY) return 'demain soir';
  return `le ${date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Tunis',
  })}`;
}

export function buildSuggestions(
  dishes: DishSnapshot[],
  ctx: SuggestionContext,
): Suggestion[] {
  const promos: (Suggestion & { surplus: number })[] = [];
  const restocks: Suggestion[] = [];
  const slow: Suggestion[] = [];
  const totalSold = dishes.reduce((sum, d) => sum + d.sold14, 0);

  for (const dish of dishes) {
    const perDay = dish.sold14 / ctx.daysObserved;

    if (dish.tracked && !dish.promoActive) {
      // 1. Stock that will expire before it sells.
      const dated = dish.batches
        .filter(
          (b): b is { remaining: number; expiresAt: Date } =>
            b.remaining > 0 &&
            b.expiresAt !== null &&
            b.expiresAt > ctx.now &&
            b.expiresAt.getTime() <= ctx.endOfDay.getTime() + DAY,
        )
        .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
      if (dated.length) {
        const first = dated[0].expiresAt;
        const atRisk = dated
          .filter((b) => b.expiresAt.getTime() <= first.getTime() + HOUR)
          .reduce((sum, b) => sum + b.remaining, 0);
        const extraDays =
          first > ctx.endOfDay
            ? Math.ceil((first.getTime() - ctx.endOfDay.getTime()) / DAY)
            : 0;
        const expected = Math.round(perDay * (dish.lateShare + extraDays));
        const surplus = atRisk - expected;
        if (surplus >= 1 && surplus / atRisk >= 0.25) {
          const ratio = surplus / atRisk;
          let percent = ratio >= 0.8 ? 50 : ratio >= 0.5 ? 30 : 20;
          const hoursLeft = (first.getTime() - ctx.now.getTime()) / HOUR;
          if (hoursLeft <= 3) percent = Math.max(percent, 30);
          const when = whenLabel(first, ctx);
          promos.push({
            id: `promo:${dish.id}:${first.toISOString()}`,
            kind: 'promo',
            dishId: dish.id,
            dishName: dish.name,
            title: `${atRisk} × ${dish.name} à vendre avant ${when}`,
            detail:
              expected > 0
                ? `Vous en vendez environ ${expected} d'ici là. Une promo de −${percent} % aide à écouler les ${surplus} restants au lieu de les jeter.`
                : `Peu de ventes enregistrées pour ce plat. Une promo de −${percent} % aide à l'écouler au lieu de le jeter.`,
            action: { type: 'promo', percent, until: first.toISOString() },
            surplus,
          });
          continue;
        }
      }

      // 2. Stock that will not last until closing.
      const neededToday = perDay * dish.lateShare;
      if (perDay >= 1 && dish.stockQty < neededToday) {
        restocks.push({
          id: `restock:${dish.id}`,
          kind: 'restock',
          dishId: dish.id,
          dishName: dish.name,
          title:
            dish.stockQty === 0
              ? `${dish.name} : en rupture`
              : `${dish.name} : il en reste ${dish.stockQty}`,
          detail: `Vous en vendez environ ${Math.round(perDay)} par jour : le stock ne tiendra pas jusqu'à la fermeture.`,
        });
        continue;
      }
    }

    // 3. Dishes nobody orders, once there is enough history to say so.
    if (
      dish.sold14 === 0 &&
      !dish.promoActive &&
      totalSold >= 20 &&
      ctx.daysObserved >= 7 &&
      (!dish.tracked || dish.stockQty > 0)
    ) {
      slow.push({
        id: `slow:${dish.id}`,
        kind: 'slow',
        dishId: dish.id,
        dishName: dish.name,
        title: `${dish.name} : aucune vente en 14 jours`,
        detail:
          'Essayez une promo de −20 % pendant une semaine ou une meilleure photo, ou retirez-le de la carte.',
        action: {
          type: 'promo',
          percent: 20,
          until: new Date(ctx.endOfDay.getTime() + 6 * DAY).toISOString(),
        },
      });
    }
  }

  promos.sort((a, b) => b.surplus - a.surplus);
  return [
    ...promos.map(({ surplus: _surplus, ...suggestion }) => suggestion),
    ...restocks,
    ...slow.slice(0, 3),
  ];
}

/**
 * A promo price: the percentage off, rounded down to 100 millimes (prices in
 * Tunisia end in 0, 100, 200… millimes), never under 100 millimes.
 */
export function promoPrice(priceMillimes: number, percent: number) {
  const raw = (priceMillimes * (100 - percent)) / 100;
  return Math.max(100, Math.floor(raw / 100) * 100);
}
