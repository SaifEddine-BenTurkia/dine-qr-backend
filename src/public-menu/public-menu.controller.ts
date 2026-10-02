import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ServiceRequestType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { PublicMenuService } from './public-menu.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const ID = /^[A-Za-z0-9_-]{8,64}$/;

class SlugParams {
  @Matches(/^[a-z0-9-]{1,60}$/)
  slug: string;
}

class ServiceParams extends SlugParams {
  @IsUUID('4')
  id: string;
}

class MenuQuery {
  @IsOptional()
  @Matches(ID)
  t?: string;
}

/** A random ID the guest's browser keeps for the visit; no login, no PII. */
class GuestSession {
  @IsString()
  @Matches(ID)
  sessionId: string;
}

export const FEEDBACK_TAGS = [
  'service',
  'plats',
  'attente',
  'prix',
  'proprete',
  'ambiance',
] as const;

class FeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FEEDBACK_TAGS.length)
  @IsIn(FEEDBACK_TAGS, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  contactConsent?: boolean;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contact?: string;

  @IsOptional()
  @Matches(ID)
  sessionId?: string;

  @IsOptional()
  @Matches(ID)
  tableToken?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 40)
  tableLabel?: string;
}

class ServiceRequestDto extends GuestSession {
  @IsEnum(ServiceRequestType)
  type: ServiceRequestType;

  @IsOptional()
  @Matches(ID)
  tableToken?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 40)
  tableLabel?: string;
}

class GuestEventDto {
  @IsString()
  @Length(1, 40)
  type: string;

  @IsOptional()
  @IsUUID('4')
  itemId?: string;

  @IsOptional()
  @IsObject()
  props?: Record<string, string | number | boolean>;
}

class EventsDto extends GuestSession {
  @IsOptional()
  @Matches(ID)
  tableToken?: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => GuestEventDto)
  events: GuestEventDto[];
}

// No authentication: these are hit by diners scanning a QR code.
@Controller('public/menu')
export class PublicMenuController {
  constructor(private readonly menus: PublicMenuService) {}

  @Get(':slug')
  getMenu(@Param() params: SlugParams, @Query() query: MenuQuery) {
    return this.menus.getMenu(params.slug, query.t);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(204)
  @Post(':slug/scan')
  trackScan(@Param() params: SlugParams, @Req() req: Request) {
    return this.menus.trackScan(params.slug, clientIp(req));
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @HttpCode(204)
  @Post(':slug/events')
  trackEvents(@Param() params: SlugParams, @Body() body: EventsDto) {
    return this.menus.trackEvents(
      params.slug,
      body.sessionId,
      body.tableToken,
      body.events,
    );
  }

  // Per address: 10 calls a minute; per table and type the service itself
  // allows one request every 2 minutes.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':slug/service')
  requestService(@Param() params: SlugParams, @Body() body: ServiceRequestDto) {
    return this.menus.requestService(params.slug, body.sessionId, body.type, {
      tableToken: body.tableToken,
      tableLabel: body.tableLabel,
    });
  }

  @Get(':slug/service/:id')
  serviceStatus(@Param() params: ServiceParams, @Query() query: GuestSession) {
    return this.menus.serviceStatus(params.slug, params.id, query.sessionId);
  }

  @Post(':slug/service/:id/cancel')
  cancelService(@Param() params: ServiceParams, @Body() body: GuestSession) {
    return this.menus.cancelService(params.slug, params.id, body.sessionId);
  }

  @Throttle({ default: { ttl: 60 * 60_000, limit: 5 } })
  @Post(':slug/feedback')
  submitFeedback(@Param() params: SlugParams, @Body() body: FeedbackDto) {
    return this.menus.submitFeedback(params.slug, body);
  }
}
