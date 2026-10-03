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

/** Sold out right now: the flag is set and its reset time has not passed. */
export function isSoldOut(dish: Pick<Dish, 'soldOut' | 'soldOutUntil'>) {
  return dish.soldOut && (!dish.soldOutUntil || dish.soldOutUntil > new Date());
}

export function toDishView(dish: Dish) {
  const soldOut = isSoldOut(dish);
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
    soldOutUntil: soldOut ? dish.soldOutUntil : null,
  };
}
