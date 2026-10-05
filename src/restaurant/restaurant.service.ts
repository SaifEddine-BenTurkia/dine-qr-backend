import {
  EntitlementsService,
  planRequired,
} from '../billing/entitlements.service';
import { TRIAL_DAYS } from '../billing/plan-catalog';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    private readonly entitlements: EntitlementsService,
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
            plan: 'standard',
            trialEndsAt: new Date(
              Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
            ),
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
    const plan = await this.entitlements.of(restaurantId);
    if (input.orderingEnabled && !plan.ordering) throw planRequired('ordering');
    if (plan.locales !== 'all' && input.enabledLocales) {
      const allowed = plan.locales;
      if (input.enabledLocales.some((code) => !allowed.includes(code))) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'PLAN_REQUIRED',
          requiredPlan: 'premium',
          message:
            'Votre pack inclut le français et l’arabe. Les autres langues font partie du pack Premium.',
        });
      }
    }
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
    orderingEnabled: restaurant.orderingEnabled,
    receiptAddress: restaurant.receiptAddress,
    receiptPhone: restaurant.receiptPhone,
    taxId: restaurant.taxId,
    receiptFooter: restaurant.receiptFooter,
  };
}
