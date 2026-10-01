import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard';
import { imageUploadOptions, requireFile } from '../common/image-upload';
import { CreateRestaurantDto, UpdateRestaurantDto } from './restaurant.dto';
import { RestaurantService } from './restaurant.service';

const UPLOAD_LIMIT = { default: { ttl: 60_000, limit: 20 } };

@UseGuards(JwtAuthGuard)
@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurants: RestaurantService) {}

  // Nest sends an empty body for a null return value; the client expects the
  // JSON literal `null` when no restaurant exists yet.
  @Get()
  async get(@CurrentUser() user: AuthUser, @Res() res: Response) {
    res.json(await this.restaurants.get(user.id));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRestaurantDto) {
    return this.restaurants.create(user.id, body);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateRestaurantDto) {
    return this.restaurants.update(user.id, body);
  }

  @Throttle(UPLOAD_LIMIT)
  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.restaurants.uploadLogo(user.id, requireFile(file));
  }

  @Throttle(UPLOAD_LIMIT)
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.restaurants.uploadImage(user.id, requireFile(file));
  }
}
