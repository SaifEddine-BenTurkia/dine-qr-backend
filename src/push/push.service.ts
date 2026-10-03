import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StaffRole } from '@prisma/client';
import * as webpush from 'web-push';
import { openSecret, sealSecret } from '../auth/totp';
import { PrismaService } from '../prisma/prisma.service';

/** Who a notification is for: the owner's devices and staff by job. */
export type PushRole = 'OWNER' | StaffRole;

export interface PushMessage {
  title: string;
  body: string;
  /** Same tag = the newer notification replaces the older one. */
  tag?: string;
  /** Stays on screen until tapped (new orders). */
  sticky?: boolean;
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** Sends one encrypted message to a browser's push service. */
export interface PushTransport {
  send(
    target: PushTarget,
    payload: string,
    vapid: VapidKeys,
  ): Promise<{ statusCode: number }>;
}

export const PUSH_TRANSPORT = Symbol('PUSH_TRANSPORT');

/** Real transport (Web Push protocol, RFC 8030/8291/8292) through web-push. */
export const webPushTransport: PushTransport = {
  async send(target, payload, vapid) {
    try {
      const res = await webpush.sendNotification(target, payload, {
        vapidDetails: vapid,
        TTL: 300,
        urgency: 'high',
      });
      return { statusCode: res.statusCode };
    } catch (error) {
      if (error instanceof webpush.WebPushError) {
        return { statusCode: error.statusCode };
      }
      throw error;
    }
  },
};

// Subscriptions are only accepted for the browsers' own push services, so the
// API can never be made to call an arbitrary address.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
];

export function isPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      PUSH_HOSTS.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}

const KEYS_SETTING = 'push.vapid';

/**
 * Notifications on staff phones and the caisse tablet, even when the screen
 * is locked (O-06). The server keys (VAPID) are generated once and kept in the
 * database, the private one sealed with a key derived from JWT_SECRET: no
 * extra configuration on the server.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private keys: Promise<VapidKeys> | null = null;
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PUSH_TRANSPORT) private readonly transport: PushTransport,
  ) {}

  private get sealKey() {
    return `${this.config.getOrThrow<string>('JWT_SECRET')}:push`;
  }

  private get subject() {
    const site = this.config.get<string>('FRONTEND_URL') ?? '';
    return site.startsWith('https://') && !site.includes('localhost')
      ? site
      : 'mailto:push@tableqr.invalid';
  }

  private vapid(): Promise<VapidKeys> {
    this.keys ??= this.loadKeys().catch((error: unknown) => {
      this.keys = null;
      throw error;
    });
    return this.keys;
  }

  private async loadKeys(): Promise<VapidKeys> {
    const stored = await this.prisma.platformSetting.findUnique({
      where: { key: KEYS_SETTING },
    });
    if (stored) {
      try {
        const { publicKey, privateKey } = JSON.parse(stored.value) as {
          publicKey: string;
          privateKey: string;
        };
        return {
          subject: this.subject,
          publicKey,
          privateKey: openSecret(privateKey, this.sealKey),
        };
      } catch {
        // JWT_SECRET changed: the old keys cannot be opened. Devices
        // subscribed with them must subscribe again.
        this.logger.warn('Push keys could not be opened; generating new ones');
        await this.prisma.pushSubscription.deleteMany();
      }
    }
    const generated = webpush.generateVAPIDKeys();
    const value = JSON.stringify({
      publicKey: generated.publicKey,
      privateKey: sealSecret(generated.privateKey, this.sealKey),
    });
    await this.prisma.platformSetting.upsert({
      where: { key: KEYS_SETTING },
      create: { key: KEYS_SETTING, value },
      update: { value },
    });
    return { subject: this.subject, ...generated };
  }

  async publicKey() {
    return { publicKey: (await this.vapid()).publicKey };
  }

  async subscribe(
    who: { restaurantId: string; staffId: string | null; role: PushRole },
    target: PushTarget,
  ) {
    if (!isPushEndpoint(target.endpoint)) {
      throw new BadRequestException('Adresse de notification non reconnue');
    }
    const data = {
      restaurantId: who.restaurantId,
      staffId: who.staffId,
      role: who.role,
      p256dh: target.keys.p256dh,
      auth: target.keys.auth,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: target.endpoint },
      create: { endpoint: target.endpoint, ...data },
      update: data,
    });
    return { subscribed: true };
  }

  async unsubscribe(restaurantId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, restaurantId },
    });
  }

  /** A test notification to one device, so staff can check it works. */
  async test(restaurantId: string, endpoint: string) {
    const subscription = await this.prisma.pushSubscription.findFirst({
      where: { endpoint, restaurantId },
    });
    if (!subscription) {
      throw new BadRequestException("Cet appareil n'est pas abonné");
    }
    await this.deliver([subscription], {
      title: 'TableQR',
      body: 'Les notifications fonctionnent sur cet appareil.',
      tag: 'test',
    });
    return { sent: true };
  }

  /**
   * Notifies the devices of the given roles. Never blocks or fails the
   * request that caused it: sending happens in the background.
   */
  notify(restaurantId: string, roles: PushRole[], message: PushMessage) {
    const task = this.prisma.pushSubscription
      .findMany({ where: { restaurantId, role: { in: roles } } })
      .then((subscriptions) => this.deliver(subscriptions, message))
      .catch((error: unknown) =>
        this.logger.warn(`Push failed: ${String(error)}`),
      )
      .finally(() => this.pending.delete(task));
    this.pending.add(task);
  }

  /** Resolves when background sends are done (used by tests). */
  async flush() {
    await Promise.all([...this.pending]);
  }

  private async deliver(
    subscriptions: {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      role: string;
    }[],
    message: PushMessage,
  ) {
    if (!subscriptions.length) return;
    const vapid = await this.vapid();
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const payload = JSON.stringify({
          ...message,
          // Each device opens its own app: the owner's dashboard or /staff.
          url:
            subscription.role === 'OWNER'
              ? '/dashboard/caisse'
              : '/staff/caisse',
        });
        const { statusCode } = await this.transport.send(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          vapid,
        );
        if (statusCode === 404 || statusCode === 410) {
          // The browser dropped this subscription.
          await this.prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
        } else if (statusCode >= 400) {
          this.logger.warn(`Push service answered ${statusCode}`);
        } else {
          await this.prisma.pushSubscription
            .update({
              where: { id: subscription.id },
              data: { lastUsedAt: new Date() },
            })
            .catch(() => undefined);
        }
      }),
    );
  }
}
