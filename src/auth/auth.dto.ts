import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Empty strings from optional form fields are stored as null, not "".
const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const PASSWORD_MIN_LENGTH = 8;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Adresse email invalide' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères`,
  })
  @MaxLength(72) // bcrypt ignores anything past 72 bytes
  password: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'Nom complet requis' })
  fullName: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @Matches(/^\+\d{1,4}$/, { message: 'Indicatif invalide' })
  phoneCountryCode?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'Pays invalide' })
  country?: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class EmailDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;
}

export class VerifyEmailQueryDto {
  @IsString()
  @Length(32, 128)
  token: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(32, 128)
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères`,
  })
  @MaxLength(72)
  password: string;
}

export class TotpCodeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s/g, '') : value,
  )
  @Matches(/^\d{6}$/, { message: 'Le code fait 6 chiffres' })
  code: string;
}
