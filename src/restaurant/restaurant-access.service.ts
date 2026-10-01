import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves the restaurant owned by the signed-in user. Every menu endpoint goes
 * through here, so a user can only ever touch rows under their own restaurant.
 */
@Injectable()
export class RestaurantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async restaurantIdFor(userId: string): Promise<string> {
    const restaurantId = await this.restaurantIdOrNull(userId);
    if (!restaurantId) {
      throw new NotFoundException("Créez d'abord votre restaurant");
    }
    return restaurantId;
  }

  /**
   * For read-only lists: an owner who has not set up a restaurant yet simply
   * has nothing to list, which is not an error.
   */
  async restaurantIdOrNull(userId: string): Promise<string | null> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });
    return restaurant?.id ?? null;
  }
}
