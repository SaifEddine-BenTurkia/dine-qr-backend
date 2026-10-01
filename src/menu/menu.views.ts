import type { Category, Dish } from '@prisma/client';

export function toCategoryView(category: Category) {
  return {
    id: category.id,
    name: category.name,
    position: category.position,
  };
}

export function toDishView(dish: Dish) {
  return {
    id: dish.id,
    categoryId: dish.categoryId,
    name: dish.name,
    description: dish.description,
    // Stored as an exact decimal; the client works with plain numbers.
    price: dish.price.toNumber(),
    imageUrl: dish.imageUrl,
    position: dish.position,
    available: dish.available,
  };
}
