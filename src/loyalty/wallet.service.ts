import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';

/**
 * Google Wallet loyalty passes (L-02).
 *
 * Official documentation used:
 * - "Add to Google Wallet" link: https://developers.google.com/wallet/retail/loyalty-cards/web
 *   (https://pay.google.com/gp/v/save/<signed_jwt>)
 * - JWT claims (iss, aud "google", typ "savetowallet", iat, origins, payload):
 *   https://developers.google.com/wallet/retail/loyalty-cards/use-cases/jwt
 * - LoyaltyClass / LoyaltyObject fields:
 *   https://developers.google.com/wallet/reference/rest/v1/loyaltyclass
 *   https://developers.google.com/wallet/reference/rest/v1/loyaltyobject
 * - Update a saved pass: PATCH
 *   https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/{resourceId}
 *   with the OAuth scope https://www.googleapis.com/auth/wallet_object.issuer
 * - Create or update the card design: POST .../v1/loyaltyClass (insert) and
 *   PATCH .../v1/loyaltyClass/{resourceId}
 *   https://developers.google.com/wallet/reference/rest/v1/loyaltyclass
 *
 * Needs a Google Wallet issuer account and a service account key from the
 * owner (QUESTIONS Q10). Until both are configured, `configured` is false and
 * guests use the web card, which shows the same thing.
 */

export const WALLET_FETCH = Symbol('WALLET_FETCH');
export type WalletFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

const SAVE_URL = 'https://pay.google.com/gp/v/save/';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_URL = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

export interface WalletCard {
  code: string;
  name: string;
  stamps: number;
}

export interface WalletProgram {
  restaurantId: string;
  restaurantName: string;
  logoUrl: string | null;
  cardTitle: string | null;
  backgroundColor: string;
  stampsRequired: number;
  rewardText: string;
  cardUrl: string;
}

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64url');

function signJwt(claims: object, privateKey: string) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(claims));
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${body}`)
    .sign(privateKey);
  return `${header}.${body}.${base64url(signature)}`;
}

/** "4 / 9" plus the rewards waiting, as shown on the pass. */
export function stampBalance(stamps: number, required: number) {
  const rewards = Math.floor(stamps / required);
  const progress = `${stamps % required} / ${required}`;
  return rewards > 0
    ? `${progress} · ${rewards} offert${rewards > 1 ? 's' : ''}`
    : progress;
}

@Injectable()
export class GoogleWalletService {
  private readonly logger = new Logger(GoogleWalletService.name);
  private readonly issuerId: string | null;
  private readonly account: {
    client_email: string;
    private_key: string;
  } | null;
  private readonly site: string;
  private token: { value: string; expiresAt: number } | null = null;
  // Designs already registered with Google, by class id.
  private readonly classes = new Map<string, string>();
  // What Google answered last time a design was refused (admin check).
  private lastError: string | null = null;

  constructor(
    config: ConfigService,
    @Inject(WALLET_FETCH) private readonly fetcher: WalletFetch,
  ) {
    this.issuerId =
      config.get<string>('GOOGLE_WALLET_ISSUER_ID')?.trim() || null;
    this.site = (config.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
    this.account = null;
    const encoded = config.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT')?.trim();
    if (encoded) {
      try {
        // The service account JSON key, base64-encoded to fit in one env line.
        const parsed = JSON.parse(
          Buffer.from(encoded, 'base64').toString('utf8'),
        ) as { client_email?: string; private_key?: string };
        if (parsed.client_email && parsed.private_key) {
          this.account = {
            client_email: parsed.client_email,
            private_key: parsed.private_key,
          };
        }
      } catch {
        this.logger.warn(
          'GOOGLE_WALLET_SERVICE_ACCOUNT is not valid base64 JSON',
        );
      }
    }
  }

  get configured() {
    return Boolean(this.issuerId && this.account);
  }

  private classId(program: WalletProgram) {
    return `${this.issuerId}.tableqr_${program.restaurantId.replace(/-/g, '')}`;
  }

  private objectId(card: WalletCard) {
    return `${this.issuerId}.${card.code}`;
  }

  private loyaltyClass(program: WalletProgram) {
    return {
      id: this.classId(program),
      issuerName: program.restaurantName.slice(0, 20),
      programName: (program.cardTitle || 'Carte de fidélité').slice(0, 20),
      programLogo: {
        sourceUri: {
          uri: program.logoUrl || `${this.site}/icons/icon-512.png`,
        },
        contentDescription: {
          defaultValue: { language: 'fr', value: program.restaurantName },
        },
      },
      hexBackgroundColor: program.backgroundColor,
      reviewStatus: 'UNDER_REVIEW',
      countryCode: 'TN',
    };
  }

  private loyaltyObject(card: WalletCard, program: WalletProgram) {
    return {
      id: this.objectId(card),
      classId: this.classId(program),
      state: 'ACTIVE',
      accountId: card.code,
      accountName: card.name.slice(0, 20),
      barcode: { type: 'QR_CODE', value: card.code },
      loyaltyPoints: {
        label: 'Tampons',
        balance: { string: stampBalance(card.stamps, program.stampsRequired) },
      },
      textModulesData: [
        {
          id: 'reward',
          header: `Après ${program.stampsRequired} tampons`,
          body: program.rewardText,
        },
      ],
      linksModuleData: {
        uris: [{ id: 'card', uri: program.cardUrl, description: 'Ma carte' }],
      },
    };
  }

  /**
   * The "Add to Google Wallet" link for one card, or null when not set up.
   * The card's design (the class) is registered with Google first, so the link
   * only carries the guest's card and stays under Google's safe length (1800
   * characters). If Google cannot be reached, the design travels in the link.
   */
  async saveUrl(
    card: WalletCard,
    program: WalletProgram,
  ): Promise<string | null> {
    if (!this.configured || !this.account) return null;
    const classReady = await this.ensureClass(program);
    const jwt = signJwt(
      {
        iss: this.account.client_email,
        aud: 'google',
        typ: 'savetowallet',
        iat: Math.floor(Date.now() / 1000),
        origins: this.site ? [this.site] : [],
        payload: {
          ...(!classReady && { loyaltyClasses: [this.loyaltyClass(program)] }),
          loyaltyObjects: [this.loyaltyObject(card, program)],
        },
      },
      this.account.private_key,
    );
    return `${SAVE_URL}${jwt}`;
  }

  /**
   * Creates the design on Google's side, or updates it when the owner changed
   * it (insert, then patch on 409 "already exists"). Remembered per process.
   */
  async ensureClass(program: WalletProgram): Promise<boolean> {
    if (!this.configured) return false;
    const loyaltyClass = this.loyaltyClass(program);
    const body = JSON.stringify(loyaltyClass);
    if (this.classes.get(loyaltyClass.id) === body) return true;
    try {
      const headers = {
        Authorization: `Bearer ${await this.accessToken()}`,
        'Content-Type': 'application/json',
      };
      let res = await this.fetcher(`${API_URL}/loyaltyClass`, {
        method: 'POST',
        headers,
        body,
      });
      if (res.status === 409) {
        res = await this.fetcher(
          `${API_URL}/loyaltyClass/${encodeURIComponent(loyaltyClass.id)}`,
          { method: 'PATCH', headers, body },
        );
      }
      if (res.status < 300) {
        this.classes.set(loyaltyClass.id, body);
        this.lastError = null;
        return true;
      }
      const answer = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      this.lastError = `${res.status} ${answer?.error?.message ?? ''}`.trim();
      this.logger.warn(`Google Wallet answered ${res.status} on a card design`);
    } catch (error) {
      this.lastError = String(error);
      this.logger.warn(`Google Wallet design update failed: ${String(error)}`);
    }
    return false;
  }

  /**
   * Admin check after the setup (Console → Système): signs in to Google,
   * registers a sample design and returns a pass the admin can save on their
   * own phone. In demo mode only the issuer's users and test accounts can.
   */
  async testPass(): Promise<{
    ok: boolean;
    detail: string;
    saveUrl: string | null;
  }> {
    if (!this.configured) {
      return {
        ok: false,
        detail:
          'GOOGLE_WALLET_ISSUER_ID ou GOOGLE_WALLET_SERVICE_ACCOUNT manquant ou illisible sur le serveur.',
        saveUrl: null,
      };
    }
    try {
      await this.accessToken();
    } catch (error) {
      return {
        ok: false,
        detail: `Google refuse la clé du compte de service (${String(error)}).`,
        saveUrl: null,
      };
    }
    const program: WalletProgram = {
      restaurantId: 'admin-test',
      restaurantName: 'TableQR',
      logoUrl: null,
      cardTitle: 'Carte de test',
      backgroundColor: '#b85433',
      stampsRequired: 9,
      rewardText: 'Carte de test de la console',
      cardUrl: this.site || 'https://pay.google.com',
    };
    const designOk = await this.ensureClass(program);
    const saveUrl = await this.saveUrl(
      { code: `admintest${Date.now().toString(36)}`, name: 'Test', stamps: 3 },
      program,
    );
    return designOk
      ? {
          ok: true,
          detail:
            'Connexion et design acceptés par Google. Ouvrez le lien pour enregistrer la carte de test.',
          saveUrl,
        }
      : {
          ok: false,
          detail: `Google a refusé le design : ${this.lastError ?? 'sans détail'}. Vérifiez que le compte de service est invité comme Développeur dans la console Google Pay & Wallet.`,
          saveUrl,
        };
  }

  /**
   * Updates the pass already saved on the guest's phone (new stamp count).
   * A card never added to Google Wallet answers 404, which is fine.
   */
  async sync(card: WalletCard, program: WalletProgram): Promise<void> {
    if (!this.configured) return;
    try {
      const token = await this.accessToken();
      const res = await this.fetcher(
        `${API_URL}/loyaltyObject/${encodeURIComponent(this.objectId(card))}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountName: card.name.slice(0, 20),
            loyaltyPoints: this.loyaltyObject(card, program).loyaltyPoints,
            textModulesData: this.loyaltyObject(card, program).textModulesData,
          }),
        },
      );
      if (res.status >= 400 && res.status !== 404) {
        this.logger.warn(
          `Google Wallet answered ${res.status} on a pass update`,
        );
      }
    } catch (error) {
      this.logger.warn(`Google Wallet update failed: ${String(error)}`);
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }
    const now = Math.floor(Date.now() / 1000);
    const assertion = signJwt(
      {
        iss: this.account!.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      },
      this.account!.private_key,
    );
    const res = await this.fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
    });
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (res.status >= 400 || !data.access_token) {
      throw new Error(`token request answered ${res.status}`);
    }
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }
}
