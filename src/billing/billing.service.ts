import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type Subscription,
  type SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PaddleSubscriptionEvent } from './paddle';
import { currencyForCountry, priceTableFrom, type PriceTable } from './pricing';
import { effectiveStatus } from './subscription-status';

const DAY_MS = 24 * 60 * 60 * 1000;

const PADDLE_STATUS: Record<
  PaddleSubscriptionEvent['data']['status'],
  SubscriptionStatus
> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  // A paused subscription does not pay, so the menu should not be served.
  paused: 'past_due',
  canceled: 'canceled',
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly prices: PriceTable;
  private readonly trialDays: number;
  private readonly paddleApiKey?: string;
  private readonly paddlePriceId?: string;
  private readonly paddleBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.prices = priceTableFrom((key) => config.get<string>(key));
    this.trialDays = Number(config.get<string>('TRIAL_DAYS') ?? 30) || 30;
    this.paddleApiKey = config.get<string>('PADDLE_API_KEY') || undefined;
    this.paddlePriceId = config.get<string>('PADDLE_PRICE_ID') || undefined;
    this.paddleBaseUrl =
      config.get<string>('PADDLE_ENV') === 'production'
        ? 'https://api.paddle.com'
        : 'https://sandbox-api.paddle.com';
  }

  async get(userId: string) {
    const [user, subscription] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { country: true },
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);
    return this.view(subscription, user.country);
  }

  async startTrial(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { country: true },
    });
    try {
      // userId is unique on subscriptions, so a second trial is impossible
      // even when two requests race.
      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          status: 'trialing',
          currency: currencyForCountry(user.country),
          trialEndsAt: new Date(Date.now() + this.trialDays * DAY_MS),
        },
      });
      return this.view(subscription, user.country);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException("L'essai gratuit a déjà été utilisé");
      }
      throw error;
    }
  }

  /** Creates a Paddle transaction that the frontend opens with Paddle.js. */
  async checkout(userId: string) {
    if (!this.paddleApiKey || !this.paddlePriceId) {
      throw new ServiceUnavailableException(
        "Le paiement en ligne n'est pas encore configuré",
      );
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { subscription: true },
    });
    if (effectiveStatus(user.subscription) === 'active') {
      throw new BadRequestException('Votre abonnement est déjà actif');
    }

    const customerId =
      user.subscription?.paddleCustomerId ??
      (await this.findOrCreateCustomer(user.email, user.fullName));

    // Only remembered on an existing row: creating one here would use up the
    // free trial of someone who opened checkout and walked away. Without a row
    // the webhook still finds the user through custom_data.
    if (user.subscription && !user.subscription.paddleCustomerId) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { paddleCustomerId: customerId },
      });
    }

    const transaction = await this.paddle<{ data: { id: string } }>(
      'POST',
      '/transactions',
      {
        items: [{ price_id: this.paddlePriceId, quantity: 1 }],
        customer_id: customerId,
        collection_mode: 'automatic',
        // Copied onto the subscription Paddle creates, which is how the
        // webhook finds the user.
        custom_data: { userId },
      },
    );
    return { transactionId: transaction.data.id };
  }

  async cancel(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription) throw new NotFoundException('Aucun abonnement');

    if (subscription.paddleSubscriptionId) {
      // Access continues until the end of the paid period; Paddle sends
      // subscription.canceled when that date arrives.
      await this.paddle(
        'POST',
        `/subscriptions/${subscription.paddleSubscriptionId}/cancel`,
        {
          effective_from: 'next_billing_period',
        },
      );
      await this.prisma.subscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: true },
      });
    } else {
      await this.prisma.subscription.update({
        where: { userId },
        data: { status: 'canceled', trialEndsAt: new Date() },
      });
    }
  }

  /** Applies a verified Paddle webhook. Safe to call repeatedly with the same event. */
  async handleWebhook(event: PaddleSubscriptionEvent) {
    if (!event.event_type.startsWith('subscription.')) return;

    const alreadyProcessed = await this.prisma.processedWebhookEvent.findUnique(
      {
        where: { id: event.event_id },
      },
    );
    if (alreadyProcessed) return;

    const data = event.data;
    const userId =
      data.custom_data?.userId ??
      (
        await this.prisma.subscription.findFirst({
          where: {
            OR: [
              { paddleSubscriptionId: data.id },
              { paddleCustomerId: data.customer_id },
            ],
          },
          select: { userId: true },
        })
      )?.userId;

    if (!userId) {
      this.logger.warn(`Paddle ${event.event_type} ${data.id} matches no user`);
      return;
    }

    const updatedAt = new Date(data.updated_at ?? event.occurred_at);
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (existing?.paddleUpdatedAt && existing.paddleUpdatedAt > updatedAt) {
      this.logger.log(`Ignoring out-of-order Paddle event ${event.event_id}`);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    if (!user) return;

    const fields = {
      status: PADDLE_STATUS[data.status] ?? 'past_due',
      paddleSubscriptionId: data.id,
      paddleCustomerId: data.customer_id,
      currentPeriodEnd: data.current_billing_period
        ? new Date(data.current_billing_period.ends_at)
        : null,
      cancelAtPeriodEnd: data.scheduled_change?.action === 'cancel',
      paddleUpdatedAt: updatedAt,
    };

    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          currency: currencyForCountry(user.country),
          ...fields,
        },
        update: fields,
      }),
      this.prisma.processedWebhookEvent.create({
        data: { id: event.event_id },
      }),
    ]);
  }

  private view(subscription: Subscription | null, country: string) {
    const currency = currencyForCountry(country);
    return {
      status: effectiveStatus(subscription),
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      pricePerMonth: this.prices[currency],
      currency,
    };
  }

  private async findOrCreateCustomer(email: string, name: string) {
    const existing = await this.paddle<{ data: { id: string }[] }>(
      'GET',
      `/customers?email=${encodeURIComponent(email)}`,
    );
    if (existing.data[0]) return existing.data[0].id;
    const created = await this.paddle<{ data: { id: string } }>(
      'POST',
      '/customers',
      {
        email,
        name,
      },
    );
    return created.data.id;
  }

  private async paddle<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.paddleBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.paddleApiKey}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `Paddle ${method} ${path} -> ${response.status}: ${detail}`,
      );
      throw new BadGatewayException('Le service de paiement est indisponible');
    }
    return (await response.json()) as T;
  }
}
