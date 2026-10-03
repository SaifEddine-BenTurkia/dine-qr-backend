import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CurrentUser,
  ForRole,
  JwtAuthGuard,
  StaffRoles,
  type AuthUser,
} from '../common/auth.guard';
import { LoyaltyService, STAMP_ICONS } from './loyalty.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const CODE = /^[A-Za-z0-9_-]{8,40}$/;

class ProgramDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3, { message: 'Au moins 3 tampons' })
  @Max(20, { message: '20 tampons au plus' })
  stampsRequired?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Décrivez la récompense (60 caractères au plus)' })
  rewardText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(10_000)
  minSpend?: number;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(20)
  cardTitle?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Couleur invalide' })
  backgroundColor?: string;

  @IsOptional()
  @IsIn(STAMP_ICONS)
  stampIcon?: string;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  terms?: string | null;
}

class NewCardDto {
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Indiquez votre prénom' })
  name: string;

  @Transform(trim)
  @IsString()
  @Length(8, 20, { message: 'Numéro de téléphone invalide' })
  phone: string;
}

class JoinDto extends NewCardDto {
  @Equals(true, {
    message: 'Cochez la case pour accepter la création de votre carte',
  })
  consent: boolean;
}

class SearchQuery {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

class CodeParams {
  @Matches(CODE)
  code: string;
}

class SlugParams {
  @Matches(/^[a-z0-9-]{1,100}$/)
  slug: string;
}

const actorName = (user: AuthUser) => user.staff?.name ?? 'Responsable';

/** Owner: program, design and members. Cashier and manager: find, stamp, reward. */
@ForRole('restaurant', 'staff')
@StaffRoles('MANAGER', 'CASHIER')
@UseGuards(JwtAuthGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @ForRole('restaurant')
  @Get('program')
  program(@CurrentUser() user: AuthUser) {
    return this.loyalty.getProgram(user.id);
  }

  @ForRole('restaurant')
  @Patch('program')
  saveProgram(@CurrentUser() user: AuthUser, @Body() body: ProgramDto) {
    return this.loyalty.saveProgram(user.id, body);
  }

  @ForRole('restaurant')
  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.loyalty.stats(user.id);
  }

  @Get('cards')
  cards(@CurrentUser() user: AuthUser, @Query() query: SearchQuery) {
    return this.loyalty.cards(user.id, query.search, !user.staff);
  }

  @Post('cards')
  create(@CurrentUser() user: AuthUser, @Body() body: NewCardDto) {
    return this.loyalty.createAtCounter(user.id, body);
  }

  @HttpCode(200)
  @Post('cards/:id/stamp')
  stamp(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.loyalty.stamp(user.id, id, actorName(user), !user.staff);
  }

  @HttpCode(200)
  @Post('cards/:id/redeem')
  redeem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.loyalty.redeem(user.id, id, actorName(user));
  }

  @ForRole('restaurant')
  @HttpCode(204)
  @Delete('cards/:id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.loyalty.remove(user.id, id);
  }
}

/** Guests: get a card from the menu, open it, delete it. */
@Controller('public/loyalty')
export class PublicLoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Throttle({ default: { ttl: 60 * 60_000, limit: 5 } })
  @Post(':slug/join')
  join(@Param() params: SlugParams, @Body() body: JoinDto) {
    return this.loyalty.join(params.slug, body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('cards/:code')
  card(@Param() params: CodeParams) {
    return this.loyalty.publicCard(params.code);
  }

  @Throttle({ default: { ttl: 60 * 60_000, limit: 10 } })
  @HttpCode(204)
  @Delete('cards/:code')
  async remove(@Param() params: CodeParams) {
    await this.loyalty.deleteOwn(params.code);
  }
}
