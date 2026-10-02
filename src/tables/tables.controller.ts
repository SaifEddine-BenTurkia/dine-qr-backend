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
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard';
import { TablesService } from './tables.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class CreateTableDto {
  @Transform(trim)
  @IsString()
  @Length(1, 40, { message: 'Nom de table requis' })
  label: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  zone?: string | null;
}

class BulkCreateTablesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(0, 10)
  prefix: string = 'T';

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  zone?: string | null;
}

class UpdateTableDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 40)
  label?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  zone?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tables.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTableDto) {
    return this.tables.create(user.id, body.label, body.zone);
  }

  @Post('bulk')
  bulk(@CurrentUser() user: AuthUser, @Body() body: BulkCreateTablesDto) {
    return this.tables.bulkCreate(user.id, body.count, body.prefix, body.zone);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateTableDto,
  ) {
    return this.tables.update(user.id, id, body);
  }

  @Post(':id/rotate-token')
  rotate(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.tables.rotateToken(user.id, id);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.tables.remove(user.id, id);
  }
}
