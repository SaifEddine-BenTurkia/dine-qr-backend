import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
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

import { sanitizeTranslations, SUPPORTED_LOCALES } from '../common/locales';

const i18n =
  (max: number) =>
  ({ value }: { value: unknown }) =>
    sanitizeTranslations(value, max);

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

  @Transform(i18n(80))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  nameI18n?: Record<string, string> | null;
}

export class UpdateCategoryDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @Transform(i18n(80))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  nameI18n?: Record<string, string> | null;

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

  @Transform(i18n(120))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  nameI18n?: Record<string, string> | null;

  @Transform(i18n(1000))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  descriptionI18n?: Record<string, string> | null;
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

  @Transform(i18n(120))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  nameI18n?: Record<string, string> | null;

  @Transform(i18n(1000))
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  descriptionI18n?: Record<string, string> | null;

  /** Locales still flagged as unchecked AI translations; the owner clears them. */
  @IsOptional()
  @IsArray()
  @IsIn(SUPPORTED_LOCALES, { each: true })
  aiLocales?: string[];

  /** P1-04: true marks the dish "Épuisé"; false makes it available again. */
  @IsOptional()
  @IsBoolean()
  soldOut?: boolean;

  /** With soldOut=true: until 05:00 tomorrow (default) or until reset by hand. */
  @IsOptional()
  @IsIn(['until_tomorrow', 'manual'])
  soldOutMode?: 'until_tomorrow' | 'manual';

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
