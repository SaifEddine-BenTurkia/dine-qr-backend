import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  maskRecipient,
  RecipientPolicy,
  type MailKind,
} from './recipient-policy';

export interface PaymentRequestEmail {
  reference: string;
  months: number;
  amount: number;
  currency: string;
}

/** Resend only delivers this test sender to the Resend account's own address. */
export const DEFAULT_SENDER = 'TableQR <onboarding@resend.dev>';

interface Message {
  html: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(
    config: ConfigService,
    private readonly recipients: RecipientPolicy,
  ) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get<string>('RESEND_FROM_EMAIL') ?? DEFAULT_SENDER;
    this.frontendUrl = (
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
  }

  async sendEmailVerification(to: string, fullName: string, token: string) {
    const link = `${this.frontendUrl}/verify-email?token=${token}`;
    await this.send(
      to,
      'Confirmez votre adresse email — TableQR',
      layout(
        `Bonjour ${escapeHtml(fullName)},`,
        'Bienvenue sur TableQR. Confirmez votre adresse email : elle sert à vous connecter, à retrouver votre mot de passe et à recevoir vos reçus.',
        'Confirmer mon adresse',
        link,
        'Ce lien expire dans 24 heures. Vous n’avez pas créé de compte ? Ignorez cet email.',
      ),
      link,
      'account',
    );
  }

  async sendPasswordReset(to: string, fullName: string, token: string) {
    const link = `${this.frontendUrl}/reset-password?token=${token}`;
    await this.send(
      to,
      'Réinitialisation de votre mot de passe — TableQR',
      layout(
        `Bonjour ${escapeHtml(fullName)},`,
        'Vous avez demandé à réinitialiser votre mot de passe. Si ce n’est pas vous, ignorez cet email.',
        'Choisir un nouveau mot de passe',
        link,
        'Ce lien expire dans 1 heure et ne sert qu’une fois.',
      ),
      link,
      'account',
    );
  }

  /** Tells the admins a restaurant wants to pay, with what they need to call back. */
  async notifyAdminsOfPaymentRequest(
    to: string[],
    request: PaymentRequestEmail & {
      ownerName: string;
      ownerEmail: string;
      ownerPhone: string | null;
      restaurantName: string | null;
      contactMethod: string;
      note: string | null;
    },
  ) {
    if (to.length === 0) return;
    const link = `${this.frontendUrl}/admin/payments`;
    const rows = [
      ['Référence', request.reference],
      ['Restaurant', request.restaurantName ?? '(pas encore créé)'],
      ['Propriétaire', request.ownerName],
      ['Email', request.ownerEmail],
      ['Téléphone', request.ownerPhone ?? '—'],
      ['Durée', `${request.months} mois`],
      ['Montant', `${request.amount} ${request.currency}`],
      ['Contact préféré', request.contactMethod],
      ['Message', request.note ?? '—'],
    ]
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#777">${label}</td><td style="padding:4px 0"><b>${escapeHtml(value)}</b></td></tr>`,
      )
      .join('');
    await this.send(
      to,
      `Nouvelle demande de paiement ${request.reference} — ${request.amount} ${request.currency}`,
      layout(
        'Bonjour,',
        `Une demande de paiement en espèces attend votre traitement.<br><br><table>${rows}</table>`,
        'Ouvrir la file des paiements',
        link,
        'Marquez la demande comme payée une fois l’argent reçu : l’abonnement est prolongé automatiquement.',
      ),
      link,
    );
  }

  async sendPaymentRequestReceived(
    to: string,
    fullName: string,
    request: PaymentRequestEmail,
  ) {
    const link = `${this.frontendUrl}/dashboard/billing`;
    await this.send(
      to,
      `Demande de paiement ${request.reference} reçue — TableQR`,
      layout(
        `Bonjour ${escapeHtml(fullName)},`,
        `Nous avons bien reçu votre demande d’abonnement de <b>${request.months} mois</b> pour <b>${request.amount} ${request.currency}</b>.<br><br>Référence : <b>${escapeHtml(request.reference)}</b><br><br>Le paiement se fait en espèces : notre équipe vous contacte pour convenir de la remise. Votre abonnement est activé dès réception.`,
        'Voir mon abonnement',
        link,
        'Indiquez votre référence dans tous vos échanges avec nous.',
      ),
      link,
    );
  }

  async sendPaymentConfirmed(
    to: string,
    fullName: string,
    request: PaymentRequestEmail & { periodEnd: Date },
  ) {
    const link = `${this.frontendUrl}/dashboard/billing`;
    const until = request.periodEnd.toLocaleDateString('fr-FR', {
      timeZone: 'Africa/Tunis',
    });
    await this.send(
      to,
      'Paiement reçu, abonnement actif — TableQR',
      layout(
        `Bonjour ${escapeHtml(fullName)},`,
        `Nous avons bien reçu votre paiement de <b>${request.amount} ${request.currency}</b> (référence ${escapeHtml(request.reference)}). Votre abonnement est actif jusqu’au <b>${until}</b>. Merci !`,
        'Voir mon abonnement',
        link,
        'Gardez cet email comme justificatif de paiement.',
      ),
      link,
    );
  }

  async sendPaymentRejected(
    to: string,
    fullName: string,
    request: PaymentRequestEmail & { adminNote: string | null },
  ) {
    const link = `${this.frontendUrl}/dashboard/billing`;
    const reason = request.adminNote
      ? `<br><br>Motif : ${escapeHtml(request.adminNote)}`
      : '';
    await this.send(
      to,
      `Demande de paiement ${request.reference} clôturée — TableQR`,
      layout(
        `Bonjour ${escapeHtml(fullName)},`,
        `Votre demande de paiement ${escapeHtml(request.reference)} a été clôturée sans paiement.${reason}<br><br>Vous pouvez en créer une nouvelle à tout moment depuis votre espace.`,
        'Voir mon abonnement',
        link,
        'Une question ? Répondez simplement à cet email.',
      ),
      link,
    );
  }

  get configured() {
    return this.resend !== null;
  }

  /**
   * Admin check (Console → Système): sends a short email and returns what
   * Resend answered, so a refused sender or domain is visible at once.
   */
  async sendTest(to: string): Promise<{ ok: boolean; detail: string }> {
    if (!this.resend) {
      return {
        ok: false,
        detail: 'RESEND_API_KEY absente : aucun email ne part.',
      };
    }
    const message = layout(
      'Bonjour,',
      'Ceci est un email de test envoyé depuis la console TableQR. S’il est arrivé, les emails de confirmation et de mot de passe arrivent aussi.',
      'Ouvrir TableQR',
      this.frontendUrl,
      `Expéditeur : ${escapeHtml(this.from)}`,
    );
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: [to],
      subject: 'Email de test — TableQR',
      html: message.html,
      text: message.text,
    });
    if (error) return { ok: false, detail: error.message };
    return {
      ok: true,
      detail: `Accepté par Resend (${data?.id ?? 'sans identifiant'})`,
    };
  }

  private async send(
    to: string | string[],
    subject: string,
    message: Message,
    link: string,
    kind: MailKind = 'notice',
  ) {
    const all = Array.isArray(to) ? to : [to];
    if (!this.resend) {
      // Development without a Resend key: nothing is sent, and the link is
      // all you need to continue.
      this.logger.warn(
        `RESEND_API_KEY not set; email "${subject}" to ${all.map(maskRecipient).join(', ')}: ${link}`,
      );
      return;
    }

    const allowed = all.filter((address) =>
      this.recipients.allows(address, kind),
    );
    const dropped = all.filter((address) => !allowed.includes(address));
    if (dropped.length > 0) {
      this.logger.warn(
        `Email "${subject}" not sent to ${dropped.map(maskRecipient).join(', ')}: not in the ${this.recipients.appEnv} allowlist`,
      );
    }
    if (allowed.length === 0) return;

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: allowed,
      subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      this.logger.error(
        `Resend failed for ${allowed.map(maskRecipient).join(', ')}: ${error.message}`,
      );
      throw new Error('Email delivery failed');
    }
  }
}

/** The same message as HTML (for mail apps) and plain text (spam filters, old phones). */
export function layout(
  greeting: string,
  body: string,
  cta: string,
  link: string,
  footer: string,
): Message {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f7f6f4;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#2a2421">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:28px;height:28px;background:#b85433;border-radius:7px;color:#ffffff;font-weight:bold;font-size:13px;text-align:center;vertical-align:middle">Q</td>
<td style="padding-left:8px;font-size:16px;font-weight:bold;color:#2a2421">TableQR</td></tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e7e4e0;border-radius:12px;padding:28px">
<div style="font-size:15px;line-height:1.6">${greeting}<br><br>${body}</div>
<div style="padding:24px 0 8px"><a href="${link}" style="background:#b85433;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:15px;display:inline-block">${cta}</a></div>
<div style="font-size:12px;line-height:1.5;color:#7a716b;padding-top:16px;border-top:1px solid #efece8;margin-top:16px">${footer}<br>Le bouton ne marche pas ? Copiez ce lien : <a href="${link}" style="color:#7a716b;word-break:break-all">${link}</a></div>
</td></tr>
<tr><td style="padding:16px 4px;font-size:11px;color:#9a918a">TableQR · Menus digitaux pour les restaurants de Tunisie</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    stripTags(greeting),
    '',
    stripTags(body),
    '',
    `${cta} : ${link}`,
    '',
    stripTags(footer),
    '',
    'TableQR · Menus digitaux pour les restaurants de Tunisie',
  ].join('\n');
  return { html, text };
}

function stripTags(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
