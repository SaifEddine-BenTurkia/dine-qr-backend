import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceRequestType } from '@prisma/client';
import { createHash } from 'node:crypto';
import { EntitlementsService } from '../billing/entitlements.service';
import { ENTITLEMENTS, effectivePlan } from '../billing/plan-catalog';
import { isMenuLive } from '../billing/subscription-status';
import { toCategoryView, toDishView } from '../menu/menu.views';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { toRestaurantView } from '../restaurant/restaurant.service';
import { ServiceHub } from '../service/service-hub';
import {
  ServiceRequestsService,
  type GuestTableRef,
} from '../service/service-requests.service';

const SCAN_DEDUP_WINDOW_MS = 30 * 60 * 1000;

/** Guest event types accepted from the browser tracker (P0-06). */
export const GUEST_EVENT_TYPES = [
  'menu_opened',
  'language_changed',
  'category_viewed',
  'item_viewed',
  'selection_item_added',
  'selection_shown',
  'wifi_viewed',
  'google_review_clicked',
] as const;

export interface GuestEvent {
  type: string;
  itemId?: string;
  props?: Record<string, string | number | boolean>;
}

export interface FeedbackInput extends GuestTableRef {
  rating: number;
  comment?: string | null;
  tags?: string[];
  contactConsent?: boolean;
  contact?: string | null;
  sessionId?: string;
}

@Injectable()
export class PublicMenuService {
  private readonly salt: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly requests: ServiceRequestsService,
    private readonly hub: ServiceHub,
    private readonly entitlements: EntitlementsService,
    private readonly push: PushService,
    config: ConfigService,
  ) {
    this.salt = config.get<string>('SCAN_HASH_SALT') ?? 'development-salt';
  }

  async getMenu(slug: string, tableToken?: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      include: {
        user: { select: { subscription: true } },
        categories: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: {
            dishes: {
              where: { available: true },
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
        tables: {
          where: { active: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { label: true, zone: true, token: true },
        },
      },
    });
    if (!restaurant) throw new NotFoundException('Menu introuvable');
    if (!isMenuLive(restaurant.user.subscription)) {
      throw new HttpException(
        "Ce menu n'est pas disponible pour le moment",
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const table = tableToken
      ? restaurant.tables.find((t) => t.token === tableToken)
      : undefined;
    // What the plan allows decides what the guest sees (P0-03).
    const plan = ENTITLEMENTS[effectivePlan(restaurant.user.subscription)];
    const view = toRestaurantView(restaurant);
    const locales =
      plan.locales === 'all'
        ? view.enabledLocales
        : view.enabledLocales.filter((code) => plan.locales.includes(code));
    const ordering = plan.ordering && restaurant.orderingEnabled;
    return {
      restaurant: {
        ...view,
        enabledLocales: locales.length ? locales : ['fr'],
        defaultLocale: locales.includes(view.defaultLocale)
          ? view.defaultLocale
          : 'fr',
        orderingEnabled: ordering,
      },
      features: { serviceCalls: plan.serviceCalls, ordering },
      categories: restaurant.categories.map((category) => ({
        ...toCategoryView(category),
        dishes: category.dishes.map(toDishView),
      })),
      // The table from the QR code, if any. Without one, guests pick their
      // table from the labels (never the tokens) when they call a waiter.
      table: table ? { label: table.label, zone: table.zone } : null,
      tables: restaurant.tables.map((t) => t.label),
    };
  }

  private async restaurantId(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Menu introuvable');
    return restaurant.id;
  }

  /** Counts a scan, at most once per visitor per restaurant every 30 minutes. */
  async trackScan(slug: string, ip: string) {
    const restaurantId = await this.restaurantId(slug);

    // Raw addresses are never stored: a salted hash is enough to de-duplicate.
    const visitorHash = createHash('sha256')
      .update(`${this.salt}:${restaurantId}:${ip}`)
      .digest('hex');

    const recent = await this.prisma.scan.findFirst({
      where: {
        restaurantId,
        visitorHash,
        createdAt: { gte: new Date(Date.now() - SCAN_DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (!recent) {
      await this.prisma.scan.create({ data: { restaurantId, visitorHash } });
    }
  }

  /** Batched guest events from the menu page. Unknown types are ignored. */
  async trackEvents(
    slug: string,
    sessionId: string,
    tableToken: string | undefined,
    events: GuestEvent[],
  ) {
    const restaurantId = await this.restaurantId(slug);
    const table = tableToken
      ? await this.requests.resolveTable(restaurantId, { tableToken })
      : null;
    const known = new Set<string>(GUEST_EVENT_TYPES);
    const data = events
      .filter((event) => known.has(event.type))
      .map((event) => ({
        restaurantId,
        type: event.type,
        sessionId,
        tableId: table?.id ?? null,
        itemId: event.itemId ?? null,
        props: event.props ?? undefined,
      }));
    if (data.length > 0) await this.prisma.event.createMany({ data });
  }

  async requestService(
    slug: string,
    sessionId: string,
    type: ServiceRequestType,
    ref: GuestTableRef,
  ) {
    const restaurantId = await this.restaurantId(slug);
    await this.entitlements.require(restaurantId, 'serviceCalls');
    return this.requests.createFromGuest(restaurantId, sessionId, type, ref);
  }

  async serviceStatus(slug: string, id: string, sessionId: string) {
    const restaurantId = await this.restaurantId(slug);
    return this.requests.guestStatus(restaurantId, id, sessionId);
  }

  async cancelService(slug: string, id: string, sessionId: string) {
    const restaurantId = await this.restaurantId(slug);
    return this.requests.cancelFromGuest(restaurantId, id, sessionId);
  }

  /**
   * Guest feedback (P1-08). Saved whatever the rating; the Google review
   * option is shown to everyone by the client, never filtered here. Ratings
   * of 3 or lower alert the staff screens at once.
   */
  async submitFeedback(slug: string, input: FeedbackInput) {
    const restaurantId = await this.restaurantId(slug);
    const table = await this.requests.resolveTable(restaurantId, input);
    const consent = input.contactConsent === true && !!input.contact;
    const feedback = await this.prisma.feedback.create({
      data: {
        restaurantId,
        rating: input.rating,
        comment: input.comment || null,
        tags: input.tags ?? [],
        tableLabel: table?.label ?? null,
        contactConsent: consent,
        contact: consent ? input.contact : null,
      },
    });
    await this.prisma.event.create({
      data: {
        restaurantId,
        type: 'feedback_submitted',
        sessionId: input.sessionId ?? null,
        tableId: table?.id ?? null,
        props: { rating: input.rating },
      },
    });
    if (input.rating <= 3) {
      this.hub.publish(restaurantId, {
        kind: 'feedback',
        id: feedback.id,
        rating: input.rating,
        table: table?.label ?? null,
        comment: feedback.comment ? feedback.comment.slice(0, 140) : null,
      });
      this.push.notify(restaurantId, ['OWNER', 'MANAGER'], {
        title: `Avis ${input.rating}/5${table ? ` · table ${table.label}` : ''}`,
        body: feedback.comment
          ? feedback.comment.slice(0, 120)
          : 'Passez voir ce client avant qu’il parte.',
        tag: `feedback-${feedback.id}`,
      });
    }
    return { success: true, id: feedback.id };
  }
}
