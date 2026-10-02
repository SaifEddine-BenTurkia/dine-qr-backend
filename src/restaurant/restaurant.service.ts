import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Restaurant } from '@prisma/client';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from './restaurant-access.service';
import type {
  CreateRestaurantDto,
  UpdateRestaurantDto,
} from './restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  async get(userId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { userId },
    });
    return restaurant ? toRestaurantView(restaurant) : null;
  }

  async create(userId: string, input: CreateRestaurantDto) {
    const existing = await this.prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Vous avez déjà un restaurant');
    }
    const trialDays = Number(this.config.get<string>('TRIAL_DAYS') ?? 30) || 30;
    try {
      const restaurant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.restaurant.create({
          data: { ...input, userId },
        });
        // The free trial starts with the restaurant, so the menu is live as
        // soon as it exists. Owners used to miss the separate "start trial"
        // step and wonder why diners saw "menu unavailable". An existing
        // subscription (trial already used, or paid) is left alone.
        await tx.subscription.upsert({
          where: { userId },
          create: {
            userId,
            status: 'trialing',
            trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
          },
          update: {},
        });
        return created;
      });
      return toRestaurantView(restaurant);
    } catch (error) {
      throw slugConflict(error);
    }
  }

  /** Whether a public menu address is free, for live feedback while typing. */
  async isSlugAvailable(userId: string, slug: string) {
    const owner = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { userId: true },
    });
    // The owner's own current address counts as available.
    return { available: !owner || owner.userId === userId };
  }

  async update(userId: string, input: UpdateRestaurantDto) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    try {
      const restaurant = await this.prisma.restaurant.update({
        where: { id: restaurantId },
        data: input,
      });
      return toRestaurantView(restaurant);
    } catch (error) {
      throw slugConflict(error);
    }
  }

  async uploadLogo(userId: string, file: Express.Multer.File) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const url = await this.media.uploadRestaurantImage(
      restaurantId,
      'logo',
      file,
    );
    await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { logoUrl: url },
    });
    return { url };
  }

  async uploadImage(userId: string, file: Express.Multer.File) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const url = await this.media.uploadRestaurantImage(
      restaurantId,
      'dishes',
      file,
    );
    return { url };
  }
}

function slugConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException('Cet identifiant (slug) est déjà utilisé');
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return new NotFoundException();
  }
  return error;
}

export function toRestaurantView(restaurant: Restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    description: restaurant.description,
    logoUrl: restaurant.logoUrl,
    primaryColor: restaurant.primaryColor,
    template: restaurant.template,
    wifiSsid: restaurant.wifiSsid,
    wifiPassword: restaurant.wifiPassword,
    googlePlaceId: restaurant.googlePlaceId,
    defaultLocale: restaurant.defaultLocale,
    // French is always offered; the default language comes first.
    enabledLocales: [
      ...new Set([
        restaurant.defaultLocale,
        ...restaurant.enabledLocales,
        'fr',
      ]),
    ],
  };
}
