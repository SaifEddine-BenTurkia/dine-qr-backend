import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './menu.dto';
import { toCategoryView } from './menu.views';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
  ) {}

  async list(userId: string) {
    const restaurantId = await this.access.restaurantIdOrNull(userId);
    if (!restaurantId) return [];
    const categories = await this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return categories.map(toCategoryView);
  }

  async create(userId: string, input: CreateCategoryDto) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const last = await this.prisma.category.aggregate({
      where: { restaurantId },
      _max: { position: true },
    });
    const category = await this.prisma.category.create({
      data: {
        restaurantId,
        name: input.name,
        nameI18n: input.nameI18n ?? Prisma.DbNull,
        position: (last._max.position ?? -1) + 1,
      },
    });
    return toCategoryView(category);
  }

  async update(userId: string, id: string, input: UpdateCategoryDto) {
    await this.findOwned(userId, id);
    const { nameI18n, ...rest } = input;
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...rest,
        ...(nameI18n !== undefined && { nameI18n: nameI18n ?? Prisma.DbNull }),
      },
    });
    return toCategoryView(category);
  }

  // Dishes go with it through the ON DELETE CASCADE foreign key.
  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.category.delete({ where: { id } });
  }

  async reorder(userId: string, ids: string[]) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const owned = await this.prisma.category.count({
      where: { restaurantId, id: { in: ids } },
    });
    if (owned !== ids.length) {
      throw new BadRequestException('Catégories inconnues dans la liste');
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.category.update({ where: { id }, data: { position } }),
      ),
    );
  }

  private async findOwned(userId: string, id: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const category = await this.prisma.category.findFirst({
      where: { id, restaurantId },
    });
    if (!category) throw new NotFoundException('Catégorie introuvable');
    return category;
  }
}
