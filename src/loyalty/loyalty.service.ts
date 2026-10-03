import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type LoyaltyCard, type LoyaltyProgram } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { EntitlementsService } from '../billing/entitlements.service';
import { ENTITLEMENTS, effectivePlan } from '../billing/plan-catalog';
import { isMenuLive } from '../billing/subscription-status';
import { fromMillimes } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import { GoogleWalletService, type WalletProgram } from './wallet.service';

export const STAMP_ICONS = ['coffee', 'star', 'heart', 'utensils', 'croissant'];
const MANUAL_STAMP_COOLDOWN_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PROGRAM = {
  enabled: false,
  stampsRequired: 9,
  rewardText: '1 consommation offerte',
  minSpendMillimes: 0,
  cardTitle: null as string | null,
  backgroundColor: '#7c2d12',
  stampIcon: 'coffee',
  terms: null as string | null,
};

export interface ProgramInput {
  enabled?: boolean;
  stampsRequired?: number;
  rewardText?: string;
  minSpend?: number;
  cardTitle?: string | null;
  backgroundColor?: string;
  stampIcon?: string;
  terms?: string | null;
}

/**
 * Phones as typed in Tunisia ("20 123 456", "+216 20123456", "0021620123456")
 * become 8 digits; other countries keep their digits (8 to 15).
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('216'))
    digits = digits.slice(3);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function programView(program: LoyaltyProgram | null) {
  const p = program ?? DEFAULT_PROGRAM;
  return {
    enabled: p.enabled,
    stampsRequired: p.stampsRequired,
    rewardText: p.rewardText,
    minSpend: fromMillimes(p.minSpendMillimes),
    cardTitle: p.cardTitle,
    backgroundColor: p.backgroundColor,
    stampIcon: p.stampIcon,
    terms: p.terms,
  };
}

function balance(card: Pick<LoyaltyCard, 'stamps'>, required: number) {
  return {
    stamps: card.stamps % required,
    stampsRequired: required,
    rewardsAvailable: Math.floor(card.stamps / required),
  };
}

const maskPhone = (phone: string) =>
  `${'•'.repeat(Math.max(0, phone.length - 3))}${phone.slice(-3)}`;

/** Loyalty stamp cards (L-01…L-03). */
@Injectable()
export class LoyaltyService {
  private readonly site: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly entitlements: EntitlementsService,
    private readonly wallet: GoogleWalletService,
    config: ConfigService,
  ) {
    this.site = (config.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
  }

  private async restaurantFor(userId: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.entitlements.require(restaurantId, 'loyalty');
    return restaurantId;
  }

  /* ───────────── owner: program and design ───────────── */

  async getProgram(userId: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { restaurantId },
    });
    return {
      ...programView(program),
      googleWallet: this.wallet.configured,
      icons: STAMP_ICONS,
    };
  }

  async saveProgram(userId: string, input: ProgramInput) {
    const restaurantId = await this.restaurantFor(userId);
    const data = {
      enabled: input.enabled,
      stampsRequired: input.stampsRequired,
      rewardText: input.rewardText,
      minSpendMillimes:
        input.minSpend === undefined
          ? undefined
          : Math.round(input.minSpend * 1000),
      cardTitle: input.cardTitle,
      backgroundColor: input.backgroundColor,
      stampIcon: input.stampIcon,
      terms: input.terms,
    };
    const program = await this.prisma.loyaltyProgram.upsert({
      where: { restaurantId },
      create: { restaurantId, ...data },
      update: data,
    });
    return {
      ...programView(program),
      googleWallet: this.wallet.configured,
      icons: STAMP_ICONS,
    };
  }

  async stats(userId: string) {
    const restaurantId = await this.restaurantFor(userId);
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [members, newMembers, active, events] = await Promise.all([
      this.prisma.loyaltyCard.count({ where: { restaurantId } }),
      this.prisma.loyaltyCard.count({
        where: { restaurantId, createdAt: { gte: since } },
      }),
      this.prisma.loyaltyCard.count({
        where: { restaurantId, lastStampAt: { gte: since } },
      }),
      this.prisma.loyaltyEvent.groupBy({
        by: ['type'],
        where: { restaurantId, createdAt: { gte: since } },
        _sum: { quantity: true },
      }),
    ]);
    const sum = (type: string) =>
      events.find((e) => e.type === type)?._sum.quantity ?? 0;
    return {
      members,
      newMembers,
      activeMembers: active,
      stamps: sum('STAMP'),
      rewards: sum('REDEEM'),
    };
  }

  /* ───────────── owner and caisse: cards ───────────── */

  /** Search by name, phone or card code (a scanned QR). */
  async cards(userId: string, search: string | undefined, full: boolean) {
    const restaurantId = await this.restaurantFor(userId);
    const program = await this.program(restaurantId);
    const term = search?.trim();
    const digits = term ? term.replace(/\D/g, '') : '';
    const where: Prisma.LoyaltyCardWhereInput = {
      restaurantId,
      ...(term && {
        OR: [
          { code: codeFrom(term) },
          { name: { contains: term, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      }),
    };
    const cards = await this.prisma.loyaltyCard.findMany({
      where,
      orderBy: [
        { lastStampAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: term ? 20 : 200,
    });
    return cards.map((card) => this.staffView(card, program, full));
  }

  /** The cashier opens a card for a guest at the counter. */
  async createAtCounter(
    userId: string,
    input: { name: string; phone: string },
  ) {
    const restaurantId = await this.restaurantFor(userId);
    const program = await this.program(restaurantId);
    if (!program.enabled) {
      throw new ConflictException(
        "Activez d'abord la carte de fidélité (Fidélité → Programme)",
      );
    }
    const card = await this.createCard(restaurantId, input);
    return this.staffView(card, program, true);
  }

  async stamp(userId: string, cardId: string, actor: string, isOwner: boolean) {
    const restaurantId = await this.restaurantFor(userId);
    const program = await this.program(restaurantId);
    const card = await this.findOwned(restaurantId, cardId);
    // Outside a payment, a card gets one stamp every 5 minutes at most
    // (a double tap, or a cashier being too generous with a friend).
    if (
      !isOwner &&
      card.lastStampAt &&
      card.lastStampAt.getTime() > Date.now() - MANUAL_STAMP_COOLDOWN_MS
    ) {
      throw new ConflictException(
        'Cette carte vient de recevoir un tampon : réessayez dans 5 minutes',
      );
    }
    const updated = await this.addStamp(restaurantId, card.id, actor, null);
    return this.staffView(updated, program, true);
  }

  async redeem(userId: string, cardId: string, actor: string) {
    const restaurantId = await this.restaurantFor(userId);
    const program = await this.program(restaurantId);
    const required = program.stampsRequired;
    await this.findOwned(restaurantId, cardId);
    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional update: a reward cannot be given twice by two taps.
      const { count } = await tx.loyaltyCard.updateMany({
        where: { id: cardId, restaurantId, stamps: { gte: required } },
        data: {
          stamps: { decrement: required },
          rewardsRedeemed: { increment: 1 },
        },
      });
      if (!count) {
        throw new ConflictException(
          "Cette carte n'a pas encore assez de tampons",
        );
      }
      await tx.loyaltyEvent.create({
        data: { cardId, restaurantId, type: 'REDEEM', quantity: 1, actor },
      });
      return tx.loyaltyCard.findUniqueOrThrow({ where: { id: cardId } });
    });
    void this.syncWallet(updated, restaurantId);
    return this.staffView(updated, program, true);
  }

  async remove(userId: string, cardId: string) {
    const restaurantId = await this.restaurantFor(userId);
    await this.findOwned(restaurantId, cardId);
    await this.prisma.loyaltyCard.delete({ where: { id: cardId } });
  }

  /**
   * Called when a bill is paid with a card attached: one stamp per bill, if
   * the program is on and the bill reaches the minimum.
   */
  async stampForBill(
    restaurantId: string,
    cardId: string,
    bill: { id: string; totalMillimes: number },
    actor: string,
  ) {
    const program = await this.program(restaurantId);
    const plan = await this.entitlements.of(restaurantId);
    if (!plan.loyalty || !program.enabled) return null;
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { id: cardId, restaurantId },
    });
    if (!card) throw new NotFoundException('Carte de fidélité introuvable');
    if (bill.totalMillimes < program.minSpendMillimes) {
      return { ...this.staffView(card, program, false), stamped: false };
    }
    const updated = await this.addStamp(restaurantId, card.id, actor, bill.id);
    return { ...this.staffView(updated, program, false), stamped: true };
  }

  /** For the receipt: the card's state after the payment. */
  async receiptLine(restaurantId: string, cardId: string) {
    const [program, card] = await Promise.all([
      this.program(restaurantId),
      this.prisma.loyaltyCard.findFirst({
        where: { id: cardId, restaurantId },
      }),
    ]);
    if (!card) return null;
    return {
      name: card.name,
      ...balance(card, program.stampsRequired),
      rewardText: program.rewardText,
    };
  }

  /* ───────────── guest ───────────── */

  /** What the guest menu needs to offer the card. */
  async publicProgram(restaurantId: string, planLoyalty: boolean) {
    if (!planLoyalty) return null;
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { restaurantId },
    });
    if (!program?.enabled) return null;
    return {
      stampsRequired: program.stampsRequired,
      rewardText: program.rewardText,
      cardTitle: program.cardTitle,
      backgroundColor: program.backgroundColor,
      stampIcon: program.stampIcon,
    };
  }

  async join(
    slug: string,
    input: { name: string; phone: string; consent: boolean },
  ) {
    if (!input.consent) {
      throw new BadRequestException(
        'Cochez la case pour accepter la création de votre carte',
      );
    }
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, user: { select: { subscription: true } } },
    });
    if (!restaurant || !isMenuLive(restaurant.user.subscription)) {
      throw new NotFoundException('Menu introuvable');
    }
    const plan = ENTITLEMENTS[effectivePlan(restaurant.user.subscription)];
    const program = await this.program(restaurant.id);
    if (!plan.loyalty || !program.enabled) {
      throw new NotFoundException("Ce restaurant n'a pas de carte de fidélité");
    }
    const card = await this.createCard(restaurant.id, input);
    return { code: card.code };
  }

  /** The guest's own card page (/c/<code>). Never shows the phone number. */
  async publicCard(code: string) {
    const card = await this.prisma.loyaltyCard.findUnique({
      where: { code },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
            loyaltyProgram: true,
          },
        },
      },
    });
    if (!card) throw new NotFoundException('Carte introuvable');
    const program = card.restaurant.loyaltyProgram;
    const view = programView(program);
    return {
      code: card.code,
      name: card.name,
      ...balance(card, view.stampsRequired),
      totalStamps: card.totalStamps,
      rewardsRedeemed: card.rewardsRedeemed,
      memberSince: card.createdAt,
      program: {
        active: view.enabled,
        rewardText: view.rewardText,
        cardTitle: view.cardTitle,
        backgroundColor: view.backgroundColor,
        stampIcon: view.stampIcon,
        terms: view.terms,
      },
      restaurant: {
        name: card.restaurant.name,
        slug: card.restaurant.slug,
        logoUrl: card.restaurant.logoUrl,
      },
      googleWalletUrl: await this.wallet.saveUrl(
        card,
        this.walletProgram(card.restaurant, program, card.code),
      ),
    };
  }

  /** The guest deletes their card and everything attached to it. */
  async deleteOwn(code: string) {
    const { count } = await this.prisma.loyaltyCard.deleteMany({
      where: { code },
    });
    if (!count) throw new NotFoundException('Carte introuvable');
  }

  /* ───────────── shared ───────────── */

  private async program(restaurantId: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { restaurantId },
    });
    return program ?? { ...DEFAULT_PROGRAM, restaurantId };
  }

  private async createCard(
    restaurantId: string,
    input: { name: string; phone: string },
  ) {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new BadRequestException('Numéro de téléphone invalide');
    try {
      return await this.prisma.loyaltyCard.create({
        data: {
          restaurantId,
          name: input.name.trim(),
          phone,
          code: randomBytes(9).toString('base64url'),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // The existing card is never handed over from a phone number alone:
        // the cashier finds it and shows its QR code.
        throw new ConflictException(
          'Une carte existe déjà pour ce numéro. Demandez à la caisse de la retrouver.',
        );
      }
      throw error;
    }
  }

  private async addStamp(
    restaurantId: string,
    cardId: string,
    actor: string,
    billId: string | null,
  ) {
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.loyaltyEvent.create({
          data: {
            cardId,
            restaurantId,
            type: 'STAMP',
            quantity: 1,
            billId,
            actor,
          },
        });
        return tx.loyaltyCard.update({
          where: { id: cardId },
          data: {
            stamps: { increment: 1 },
            totalStamps: { increment: 1 },
            lastStampAt: new Date(),
          },
        });
      });
      void this.syncWallet(updated, restaurantId);
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ce ticket a déjà donné un tampon');
      }
      throw error;
    }
  }

  private async syncWallet(card: LoyaltyCard, restaurantId: string) {
    if (!this.wallet.configured) return;
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, logoUrl: true, loyaltyProgram: true },
    });
    if (!restaurant) return;
    await this.wallet.sync(
      card,
      this.walletProgram(restaurant, restaurant.loyaltyProgram, card.code),
    );
  }

  private walletProgram(
    restaurant: { id: string; name: string; logoUrl: string | null },
    program: LoyaltyProgram | null,
    code: string,
  ): WalletProgram {
    const view = programView(program);
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      logoUrl: restaurant.logoUrl,
      cardTitle: view.cardTitle,
      backgroundColor: view.backgroundColor,
      stampsRequired: view.stampsRequired,
      rewardText: view.rewardText,
      cardUrl: `${this.site}/c/${code}`,
    };
  }

  private async findOwned(restaurantId: string, id: string) {
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { id, restaurantId },
    });
    if (!card) throw new NotFoundException('Carte de fidélité introuvable');
    return card;
  }

  private staffView(
    card: LoyaltyCard,
    program: {
      stampsRequired: number;
      rewardText: string;
      minSpendMillimes: number;
    },
    full: boolean,
  ) {
    return {
      id: card.id,
      code: card.code,
      name: card.name,
      // Cashiers see enough of the number to confirm it with the guest.
      phone: full ? card.phone : maskPhone(card.phone),
      ...balance(card, program.stampsRequired),
      rewardText: program.rewardText,
      // A ticket under this amount gives no stamp (0 = every ticket).
      minSpend: fromMillimes(program.minSpendMillimes),
      totalStamps: card.totalStamps,
      rewardsRedeemed: card.rewardsRedeemed,
      createdAt: card.createdAt,
      lastStampAt: card.lastStampAt,
      cardUrl: `${this.site}/c/${card.code}`,
    };
  }
}

/** A scanned QR holds the code, or the card's address ending with it. */
function codeFrom(text: string) {
  const match = /\/c\/([A-Za-z0-9_-]{8,40})\/?$/.exec(text);
  return match ? match[1] : text;
}
