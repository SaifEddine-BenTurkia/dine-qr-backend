import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { SUPPORTED_LOCALES } from '../common/locales';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  IsBoolean,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Optional text fields: "" means "clear it".
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const MENU_TEMPLATES = [
  'classic',
  'elegant',
  'minimal',
  'street',
  'night',
] as const;
export type MenuTemplate = (typeof MENU_TEMPLATES)[number];

export class CreateRestaurantDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'Nom du restaurant requis' })
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "L'identifiant ne peut contenir que des lettres minuscules, chiffres et tirets",
  })
  @Length(3, 60)
  slug: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  logoUrl?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Couleur invalide (#RRGGBB)' })
  primaryColor?: string | null;

  @IsOptional()
  @IsIn(MENU_TEMPLATES, { message: 'Modèle de menu inconnu' })
  template?: string;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  wifiSsid?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  wifiPassword?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-Za-z0-9_-]{10,200}$/, { message: 'Place ID Google invalide' })
  googlePlaceId?: string | null;

  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  defaultLocale?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(SUPPORTED_LOCALES.length)
  @IsIn(SUPPORTED_LOCALES, { each: true })
  enabledLocales?: string[];

  // Ordering and receipts (O-01, O-03).
  @IsOptional()
  @IsBoolean()
  orderingEnabled?: boolean;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(160)
  receiptAddress?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(30)
  receiptPhone?: string | null;

  // Matricule fiscal, printed on receipts.
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  taxId?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  receiptFooter?: string | null;
}

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {}
