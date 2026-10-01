import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { PublicMenuService } from './public-menu.service';

class SlugParams {
  @Matches(/^[a-z0-9-]{1,60}$/)
  slug: string;
}

class FeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

// No authentication: these are hit by diners scanning a QR code.
@Controller('public/menu')
export class PublicMenuController {
  constructor(private readonly menus: PublicMenuService) {}

  @Get(':slug')
  getMenu(@Param() params: SlugParams) {
    return this.menus.getMenu(params.slug);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(204)
  @Post(':slug/scan')
  trackScan(@Param() params: SlugParams, @Req() req: Request) {
    return this.menus.trackScan(params.slug, clientIp(req));
  }

  @Throttle({ default: { ttl: 60 * 60_000, limit: 5 } })
  @Post(':slug/feedback')
  submitFeedback(@Param() params: SlugParams, @Body() body: FeedbackDto) {
    return this.menus.submitFeedback(params.slug, body.rating, body.comment);
  }
}
