import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { isMenuLive } from '../billing/subscription-status';
import { toCategoryView, toDishView } from '../menu/menu.views';
import { PrismaService } from '../prisma/prisma.service';
import { toRestaurantView } from '../restaurant/restaurant.service';

const SCAN_DEDUP_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class PublicMenuService {
  private readonly salt: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.salt = config.get<string>('SCAN_HASH_SALT') ?? 'development-salt';
  }

  async getMenu(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      include: {
        user: { select: { subscription: true } },
        categories: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: {
            dishes: {
              where: { available: true },
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!restaurant) throw new NotFoundException('Menu introuvable');
    if (!isMenuLive(restaurant.user.subscription)) {
      throw new HttpException(
        "Ce menu n'est pas disponible pour le moment",
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return {
      restaurant: toRestaurantView(restaurant),
      categories: restaurant.categories.map((category) => ({
        ...toCategoryView(category),
        dishes: category.dishes.map(toDishView),
      })),
    };
  }

  /** Counts a scan, at most once per visitor per restaurant every 30 minutes. */
  async trackScan(slug: string, ip: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Menu introuvable');

    // Raw addresses are never stored: a salted hash is enough to de-duplicate.
    const visitorHash = createHash('sha256')
      .update(`${this.salt}:${restaurant.id}:${ip}`)
      .digest('hex');

    const recent = await this.prisma.scan.findFirst({
      where: {
        restaurantId: restaurant.id,
        visitorHash,
        createdAt: { gte: new Date(Date.now() - SCAN_DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (!recent) {
      await this.prisma.scan.create({
        data: { restaurantId: restaurant.id, visitorHash },
      });
    }
  }

  async submitFeedback(slug: string, rating: number, comment?: string | null) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Menu introuvable');
    const feedback = await this.prisma.feedback.create({
      data: { restaurantId: restaurant.id, rating, comment: comment || null },
    });
    return { success: true, id: feedback.id };
  }
}
