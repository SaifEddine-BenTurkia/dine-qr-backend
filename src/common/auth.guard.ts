import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  ver: number;
}

type AuthedRequest = Request & { user?: AuthUser };

const ALLOW_UNVERIFIED = 'allowUnverifiedEmail';

const QUERY_TOKEN = 'allowQueryToken';

/**
 * Accepts the session token as `?access_token=` on this route. Only for
 * Server-Sent Events: the browser's EventSource cannot send headers.
 */
export const AllowQueryToken = () => SetMetadata(QUERY_TOKEN, true);

/** Lets a signed-in user whose email is not yet verified reach this route. */
export const AllowUnverifiedEmail = () => SetMetadata(ALLOW_UNVERIFIED, true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    let [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const queryToken = req.query?.access_token;
    if (
      !token &&
      typeof queryToken === 'string' &&
      this.reflector.getAllAndOverride<boolean>(QUERY_TOKEN, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      [scheme, token] = ['Bearer', queryToken];
    }
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentification requise');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }

    // Looked up on every request so a password reset revokes older sessions.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        tokenVersion: true,
        emailVerifiedAt: true,
      },
    });
    if (!user || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED,
      [context.getHandler(), context.getClass()],
    );
    if (!user.emailVerifiedAt && !allowUnverified) {
      throw new ForbiddenException('Veuillez vérifier votre adresse email');
    }

    req.user = { id: user.id, email: user.email };
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new UnauthorizedException();
    return req.user;
  },
);
