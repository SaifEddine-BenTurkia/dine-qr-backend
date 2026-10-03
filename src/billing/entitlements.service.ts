import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ENTITLEMENTS,
  PLAN_NAMES,
  effectivePlan,
  planFor,
  type Entitlements,
  type Feature,
  type PlanId,
} from './plan-catalog';

/** 403 with a code the apps turn into an "upgrade" screen. */
export function planRequired(feature: Feature) {
  const plan = planFor(feature);
  return new ForbiddenException({
    statusCode: 403,
    code: 'PLAN_REQUIRED',
    requiredPlan: plan,
    message: `Cette fonction fait partie du pack ${PLAN_NAMES[plan]}`,
  });
}

/** What a restaurant's plan includes (P0-03). Always checked on the server. */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async planOf(restaurantId: string): Promise<PlanId> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { user: { select: { subscription: true } } },
    });
    return effectivePlan(restaurant?.user.subscription ?? null);
  }

  async of(restaurantId: string): Promise<Entitlements> {
    return ENTITLEMENTS[await this.planOf(restaurantId)];
  }

  async require(restaurantId: string, feature: Feature) {
    const entitlements = await this.of(restaurantId);
    if (!entitlements[feature]) throw planRequired(feature);
  }
}
