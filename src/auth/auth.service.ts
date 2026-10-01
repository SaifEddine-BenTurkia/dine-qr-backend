import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserTokenType, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { JwtPayload } from '../common/auth.guard';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterDto } from './auth.dto';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

// Compared against when the email is unknown, so a missing account takes as
// long to reject as a wrong password and response time does not reveal which.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_ROUNDS);

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  country: string;
  createdAt: Date;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterDto) {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone,
          phoneCountryCode: input.phoneCountryCode,
          country: input.country ?? 'TN',
          address: input.address,
          taxId: input.taxId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Un compte existe déjà avec cet email');
      }
      throw error;
    }

    await this.sendVerification(user);
    return { token: await this.issueToken(user), user: toPublicUser(user) };
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    const valid = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    return { token: await this.issueToken(user), user: toPublicUser(user) };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    return toPublicUser(user);
  }

  async verifyEmail(token: string) {
    const record = await this.consumeToken(
      token,
      UserTokenType.EMAIL_VERIFICATION,
    );
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { message: 'Email vérifié avec succès' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await this.sendVerification(user);
    }
    return {
      message:
        'Si un compte non vérifié existe pour cet email, un nouveau lien a été envoyé.',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = await this.createToken(
        user.id,
        UserTokenType.PASSWORD_RESET,
        RESET_TTL_MS,
      );
      await this.mail
        .sendPasswordReset(user.email, user.fullName, token)
        .catch((error: unknown) =>
          this.logger.error(`Password reset email failed: ${String(error)}`),
        );
    }
    // Same answer whether or not the account exists.
    return {
      message:
        'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
    };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.consumeToken(token, UserTokenType.PASSWORD_RESET);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        // Signs out every existing session.
        tokenVersion: { increment: 1 },
        // Following the link proves the user controls the inbox.
        emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
      },
    });
    return { message: 'Mot de passe mis à jour' };
  }

  private issueToken(user: User) {
    const payload: JwtPayload = { sub: user.id, ver: user.tokenVersion };
    return this.jwt.signAsync(payload);
  }

  private async sendVerification(user: User) {
    const token = await this.createToken(
      user.id,
      UserTokenType.EMAIL_VERIFICATION,
      VERIFICATION_TTL_MS,
    );
    // A delivery failure should not lose the account; the user can ask again.
    await this.mail
      .sendEmailVerification(user.email, user.fullName, token)
      .catch((error: unknown) =>
        this.logger.error(`Verification email failed: ${String(error)}`),
      );
  }

  private async createToken(
    userId: string,
    type: UserTokenType,
    ttlMs: number,
  ) {
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      // Only the newest link of each kind works.
      this.prisma.userToken.deleteMany({
        where: { userId, type, usedAt: null },
      }),
      this.prisma.userToken.create({
        data: {
          userId,
          type,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);
    return token;
  }

  private async consumeToken(token: string, type: UserTokenType) {
    const record = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !record ||
      record.type !== type ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException('Lien invalide ou expiré.');
    }
    // Conditional update so two concurrent requests cannot both use the link.
    const { count } = await this.prisma.userToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new BadRequestException('Lien invalide ou expiré.');
    return record;
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    country: user.country,
    createdAt: user.createdAt,
    emailVerified: user.emailVerifiedAt !== null,
  };
}
