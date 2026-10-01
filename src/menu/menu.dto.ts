import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80, { message: 'Nom de catégorie requis' })
  name: string;
}

export class UpdateCategoryDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class ReorderDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class ListDishesQueryDto {
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export class CreateDishDto {
  @IsUUID('4')
  categoryId: string;

  @Transform(trim)
  @IsString()
  @Length(1, 120, { message: 'Nom du plat requis' })
  name: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Prix invalide' })
  @Min(0)
  @Max(1_000_000)
  price: number;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}

export class UpdateDishDto {
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1_000_000)
  price?: number;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
