import { fromMillimes } from '../common/money';
import type { Category, Dish, Prisma } from '@prisma/client';
import type { Translations } from '../common/locales';

const translations = (value: Prisma.JsonValue | null): Translations =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function toCategoryView(category: Category) {
  return {
    id: category.id,
    name: category.name,
    nameI18n: translations(category.nameI18n),
    aiLocales: category.aiLocales,
    position: category.position,
  };
}

/**
 * Sold out right now: the flag is set and its reset time has not passed, or
 * the dish's stock is tracked and empty (S-01).
 */
export function isSoldOut(
  dish: Pick<Dish, 'soldOut' | 'soldOutUntil' | 'trackStock' | 'stockQty'>,
  stockEnabled = true,
) {
  return (
    (dish.soldOut && (!dish.soldOutUntil || dish.soldOutUntil > new Date())) ||
    (stockEnabled && dish.trackStock && dish.stockQty <= 0)
  );
}

/** The promo price while it runs (S-04), otherwise the menu price. */
export function effectivePriceMillimes(
  dish: Pick<Dish, 'priceMillimes' | 'promoPriceMillimes' | 'promoEndsAt'>,
  now = new Date(),
) {
  return dish.promoPriceMillimes !== null &&
    dish.promoEndsAt !== null &&
    dish.promoEndsAt > now
    ? dish.promoPriceMillimes
    : dish.priceMillimes;
}

export function toDishView(dish: Dish, options: { stock?: boolean } = {}) {
  const stockEnabled = options.stock ?? true;
  const soldOut = isSoldOut(dish, stockEnabled);
  const effective = effectivePriceMillimes(dish);
  const promo = effective !== dish.priceMillimes;
  return {
    id: dish.id,
    categoryId: dish.categoryId,
    name: dish.name,
    description: dish.description,
    nameI18n: translations(dish.nameI18n),
    descriptionI18n: translations(dish.descriptionI18n),
    // Translations made by AI and not yet checked ("IA", "à revoir").
    aiLocales: dish.aiLocales,
    // Stored in millimes; the API speaks dinars (number, up to 3 decimals).
    price: fromMillimes(dish.priceMillimes),
    priceMillimes: dish.priceMillimes,
    imageUrl: dish.imageUrl,
    position: dish.position,
    available: dish.available,
    soldOut,
    soldOutUntil: soldOut && dish.soldOut ? dish.soldOutUntil : null,
    // Promo running now: what the guest pays, and until when.
    promoPrice: promo ? fromMillimes(effective) : null,
    promoPercent: promo
      ? Math.round((1 - effective / dish.priceMillimes) * 100)
      : null,
    promoEndsAt: promo ? dish.promoEndsAt : null,
    trackStock: stockEnabled && dish.trackStock,
    stockQty: stockEnabled && dish.trackStock ? dish.stockQty : null,
  };
}
