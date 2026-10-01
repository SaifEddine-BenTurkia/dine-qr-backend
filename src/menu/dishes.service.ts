import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import type { CreateDishDto, UpdateDishDto } from './menu.dto';
import { toDishView } from './menu.views';

@Injectable()
export class DishesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly media: MediaService,
  ) {}

  async list(userId: string, categoryId?: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const dishes = await this.prisma.dish.findMany({
      where: { category: { restaurantId }, ...(categoryId && { categoryId }) },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return dishes.map(toDishView);
  }

  async create(userId: string, input: CreateDishDto) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.assertCategoryOwned(restaurantId, input.categoryId);
    const last = await this.prisma.dish.aggregate({
      where: { categoryId: input.categoryId },
      _max: { position: true },
    });
    const dish = await this.prisma.dish.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        imageUrl: input.imageUrl,
        available: input.available ?? true,
        position: (last._max.position ?? -1) + 1,
      },
    });
    return toDishView(dish);
  }

  async update(userId: string, id: string, input: UpdateDishDto) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    if (input.categoryId) {
      await this.assertCategoryOwned(restaurantId, input.categoryId);
    }
    const dish = await this.prisma.dish.update({ where: { id }, data: input });
    return toDishView(dish);
  }

  async remove(userId: string, id: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    await this.prisma.dish.delete({ where: { id } });
  }

  async reorder(userId: string, ids: string[]) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const owned = await this.prisma.dish.count({
      where: { id: { in: ids }, category: { restaurantId } },
    });
    if (owned !== ids.length) {
      throw new BadRequestException('Plats inconnus dans la liste');
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.dish.update({ where: { id }, data: { position } }),
      ),
    );
  }

  async uploadImage(userId: string, id: string, file: Express.Multer.File) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    const imageUrl = await this.media.uploadRestaurantImage(
      restaurantId,
      'dishes',
      file,
    );
    await this.prisma.dish.update({ where: { id }, data: { imageUrl } });
    return { imageUrl };
  }

  private async findOwned(restaurantId: string, id: string) {
    const dish = await this.prisma.dish.findFirst({
      where: { id, category: { restaurantId } },
    });
    if (!dish) throw new NotFoundException('Plat introuvable');
    return dish;
  }

  private async assertCategoryOwned(restaurantId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, restaurantId },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Catégorie introuvable');
  }
}
