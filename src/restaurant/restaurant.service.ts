import {
  ConflictException,
  Injectable,
  NotFoundException,
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
      const restaurant = await this.prisma.restaurant.create({
        data: { ...input, userId },
      });
      return toRestaurantView(restaurant);
    } catch (error) {
      throw slugConflict(error);
    }
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
  };
}
