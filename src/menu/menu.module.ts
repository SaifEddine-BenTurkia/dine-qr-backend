import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { DishesService } from './dishes.service';
import { CategoriesController, DishesController } from './menu.controllers';

@Module({
  controllers: [CategoriesController, DishesController],
  providers: [CategoriesService, DishesService],
})
export class MenuModule {}
