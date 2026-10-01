import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard';
import { imageUploadOptions, requireFile } from '../common/image-upload';
import { CategoriesService } from './categories.service';
import { DishesService } from './dishes.service';
import {
  CreateCategoryDto,
  CreateDishDto,
  ListDishesQueryDto,
  ReorderDto,
  UpdateCategoryDto,
  UpdateDishDto,
} from './menu.dto';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.categories.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateCategoryDto) {
    return this.categories.create(user.id, body);
  }

  // Declared before ':id' routes so "reorder" is never read as an id.
  @HttpCode(204)
  @Post('reorder')
  reorder(@CurrentUser() user: AuthUser, @Body() body: ReorderDto) {
    return this.categories.reorder(user.id, body.ids);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categories.update(user.id, id, body);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categories.remove(user.id, id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('dishes')
export class DishesController {
  constructor(private readonly dishes: DishesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDishesQueryDto) {
    return this.dishes.list(user.id, query.categoryId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateDishDto) {
    return this.dishes.create(user.id, body);
  }

  @HttpCode(204)
  @Post('reorder')
  reorder(@CurrentUser() user: AuthUser, @Body() body: ReorderDto) {
    return this.dishes.reorder(user.id, body.ids);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDishDto,
  ) {
    return this.dishes.update(user.id, id, body);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dishes.remove(user.id, id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.dishes.uploadImage(user.id, id, requireFile(file));
  }
}
