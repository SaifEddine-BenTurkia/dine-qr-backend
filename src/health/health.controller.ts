import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // The process is up. Used by the container healthcheck.
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // The process can serve traffic. Used by the deploy script before it reports success.
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'reachable' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
