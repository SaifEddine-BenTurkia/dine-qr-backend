import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type PaymentContactMethod,
  type PaymentRequest,
  type PaymentRequestStatus,
  type Subscription,
} from '@prisma/client';
import { randomInt } from 'node:crypto';
import { AdminAccess } from '../common/admin';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CURRENCY, plansFrom, type PaymentContact, type Plan } from './plans';
import {
  addMonths,
  effectiveStatus,
  paidPeriodStart,
} from './subscription-status';

const DAY_MS = 24 * 60 * 60 * 1000;

// No 0/O or 1/I: references are read out over the phone.
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface CreatePaymentRequestInput {
  months: number;
  contactMethod: PaymentContactMethod;
  note?: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly pricePerMonth: number;
  private readonly plans: Plan[];
  private readonly trialDays: number;
  private readonly contact: PaymentContact;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly admins: AdminAccess,
    config: ConfigService,
  ) {
    const price = Number(config.get<string>('PRICE_TND'));
    this.pricePerMonth = Number.isFinite(price) && price > 0 ? price : 35;
    this.plans = plansFrom(
      this.pricePerMonth,
      config.get<string>('PAYMENT_PLAN_MONTHS'),
    );
    this.trialDays = Number(config.get<string>('TRIAL_DAYS') ?? 30) || 30;
    this.contact = {
      whatsapp: config.get<string>('PAYMENT_WHATSAPP') || null,
      email: config.get<string>('PAYMENT_CONTACT_EMAIL') || null,
      phone: config.get<string>('PAYMENT_PHONE') || null,
    };
  }

  async get(userId: string) {
    const [subscription, pending] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.prisma.paymentRequest.findFirst({
        where: { userId, status: 'PENDING' },
      }),
    ]);
    return this.view(subscription, pending);
  }

  async startTrial(userId: string) {
    try {
      // userId is unique on subscriptions, so a second trial is impossible
      // even when two requests race.
      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          status: 'trialing',
          currency: CURRENCY,
          trialEndsAt: new Date(Date.now() + this.trialDays * DAY_MS),
        },
      });
      return this.view(subscription, null);
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

  /** Puts a cash payment in the admin queue. One open request per owner. */
  async createPaymentRequest(userId: string, input: CreatePaymentRequestInput) {
    const plan = this.plans.find((p) => p.months === input.months);
    if (!plan) throw new BadRequestException('Durée non proposée');

    const request = await this.prisma.$transaction(async (tx) => {
      // Locks the owner's row so two clicks cannot open two requests.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const open = await tx.paymentRequest.findFirst({
        where: { userId, status: 'PENDING' },
        select: { reference: true },
      });
      if (open) {
        throw new ConflictException(
          `Une demande est déjà en cours (${open.reference})`,
        );
      }
      return tx.paymentRequest.create({
        data: {
          reference: generateReference(),
          userId,
          months: plan.months,
          amount: plan.amount,
          currency: CURRENCY,
          contactMethod: input.contactMethod,
          note: input.note || null,
        },
      });
    });

    await this.announce(request);
    return toRequestView(request);
  }

  async cancelPaymentRequest(userId: string, id: string) {
    const { count } = await this.prisma.paymentRequest.updateMany({
      where: { id, userId, status: 'PENDING' },
      data: { status: 'CANCELED', handledAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Aucune demande en cours');
  }

  async listMyRequests(userId: string) {
    const requests = await this.prisma.paymentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return requests.map(toRequestView);
  }

  // ---------------------------------------------------------------- admin --

  async adminList(status?: PaymentRequestStatus) {
    const requests = await this.prisma.paymentRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            subscription: true,
            restaurant: { select: { name: true, slug: true } },
          },
        },
      },
    });
    return requests.map((request) => ({
      ...toRequestView(request),
      amountReceived: request.amountReceived?.toNumber() ?? null,
      handledBy: request.handledBy,
      owner: {
        fullName: request.user.fullName,
        email: request.user.email,
        phone: request.user.phone,
      },
      restaurant: request.user.restaurant,
      subscription: {
        status: effectiveStatus(request.user.subscription),
        trialEndsAt: request.user.subscription?.trialEndsAt ?? null,
        currentPeriodEnd: request.user.subscription?.currentPeriodEnd ?? null,
      },
    }));
  }

  /** Records the cash and extends the subscription by the months paid for. */
  async markPaid(
    id: string,
    adminEmail: string,
    input: { amountReceived?: number; adminNote?: string },
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.paymentRequest.findUnique({
        where: { id },
        include: { user: { include: { subscription: true } } },
      });
      if (!request) throw new NotFoundException('Demande introuvable');

      const now = new Date();
      const periodStart = paidPeriodStart(request.user.subscription, now);
      const periodEnd = addMonths(periodStart, request.months);

      // Conditional update: two admins clicking at once cannot both extend.
      const { count } = await tx.paymentRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'PAID',
          amountReceived: input.amountReceived ?? request.amount,
          adminNote: input.adminNote || null,
          handledBy: adminEmail,
          handledAt: now,
          periodStart,
          periodEnd,
        },
      });
      if (count === 0) {
        throw new ConflictException('Cette demande a déjà été traitée');
      }

      await tx.subscription.upsert({
        where: { userId: request.userId },
        create: {
          userId: request.userId,
          status: 'active',
          currency: request.currency,
          currentPeriodEnd: periodEnd,
        },
        update: { status: 'active', currentPeriodEnd: periodEnd },
      });

      return { request, periodEnd };
    });

    const { request, periodEnd } = result;
    await this.mail
      .sendPaymentConfirmed(request.user.email, request.user.fullName, {
        ...emailFields(request),
        periodEnd,
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Payment confirmation email failed: ${String(error)}`,
        ),
      );
    return { status: 'PAID', periodEnd };
  }

  async reject(id: string, adminEmail: string, adminNote?: string) {
    const { count } = await this.prisma.paymentRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        adminNote: adminNote || null,
        handledBy: adminEmail,
        handledAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('Cette demande a déjà été traitée');
    }
    const request = await this.prisma.paymentRequest.findUniqueOrThrow({
      where: { id },
      include: { user: { select: { email: true, fullName: true } } },
    });
    await this.mail
      .sendPaymentRejected(request.user.email, request.user.fullName, {
        ...emailFields(request),
        adminNote: request.adminNote,
      })
      .catch((error: unknown) =>
        this.logger.error(`Payment rejection email failed: ${String(error)}`),
      );
    return { status: 'REJECTED' };
  }

  // -------------------------------------------------------------- helpers --

  private view(
    subscription: Subscription | null,
    pending: PaymentRequest | null,
  ) {
    return {
      status: effectiveStatus(subscription),
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      pricePerMonth: this.pricePerMonth,
      currency: CURRENCY,
      plans: this.plans,
      pendingRequest: pending ? toRequestView(pending) : null,
      paymentContact: this.contact,
    };
  }

  // Emails are best effort: the request is already saved and visible in the
  // admin queue, so a delivery failure must not fail the owner's action.
  private async announce(request: PaymentRequest) {
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: {
        email: true,
        fullName: true,
        phone: true,
        restaurant: { select: { name: true } },
      },
    });
    const fields = emailFields(request);
    await Promise.all([
      this.mail
        .notifyAdminsOfPaymentRequest(this.admins.notificationEmails(), {
          ...fields,
          ownerName: owner.fullName,
          ownerEmail: owner.email,
          ownerPhone: owner.phone,
          restaurantName: owner.restaurant?.name ?? null,
          contactMethod: request.contactMethod,
          note: request.note,
        })
        .catch((error: unknown) =>
          this.logger.error(
            `Admin payment notification failed: ${String(error)}`,
          ),
        ),
      this.mail
        .sendPaymentRequestReceived(owner.email, owner.fullName, fields)
        .catch((error: unknown) =>
          this.logger.error(`Payment receipt email failed: ${String(error)}`),
        ),
    ]);
  }
}

function generateReference() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  // 32^6 ≈ 1 billion codes; a collision fails the unique index and the owner
  // simply retries.
  return `TQ-${code}`;
}

function emailFields(request: PaymentRequest) {
  return {
    reference: request.reference,
    months: request.months,
    amount: request.amount.toNumber(),
    currency: request.currency,
  };
}

export function toRequestView(request: PaymentRequest) {
  return {
    id: request.id,
    reference: request.reference,
    months: request.months,
    amount: request.amount.toNumber(),
    currency: request.currency,
    contactMethod: request.contactMethod,
    note: request.note,
    status: request.status,
    adminNote: request.adminNote,
    periodEnd: request.periodEnd,
    createdAt: request.createdAt,
    handledAt: request.handledAt,
  };
}
