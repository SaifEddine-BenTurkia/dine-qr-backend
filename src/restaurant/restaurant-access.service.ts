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
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!restaurant) {
      throw new NotFoundException("Créez d'abord votre restaurant");
    }
    return restaurant.id;
  }
}
