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
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StaffRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  CurrentUser,
  ForRole,
  JwtAuthGuard,
  type AuthUser,
} from '../common/auth.guard';
import { StaffService } from './staff.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const PIN = /^\d{4,6}$/;
const PIN_MESSAGE = 'Le PIN fait 4 à 6 chiffres';

class CreateStaffDto {
  @Transform(trim)
  @IsString()
  @Length(1, 60, { message: 'Nom requis' })
  name: string;

  @IsEnum(StaffRole)
  role: StaffRole;

  @Matches(PIN, { message: PIN_MESSAGE })
  pin: string;
}

class UpdateStaffDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  @IsOptional()
  @Matches(PIN, { message: PIN_MESSAGE })
  pin?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class StaffLoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(1, 100)
  restaurant: string;

  @Matches(PIN, { message: PIN_MESSAGE })
  pin: string;
}

/** The owner manages the team. */
@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.staff.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateStaffDto) {
    return this.staff.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffDto,
  ) {
    return this.staff.update(user.id, id, body);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.staff.remove(user.id, id);
  }
}

/** Staff sign in on the restaurant's device. */
@Controller('staff-auth')
export class StaffAuthController {
  constructor(private readonly staff: StaffService) {}

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() body: StaffLoginDto) {
    return this.staff.login(body.restaurant, body.pin);
  }

  @UseGuards(JwtAuthGuard)
  @ForRole('staff')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.staff.me(user.id);
  }
}
