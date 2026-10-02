import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { maskRecipient, RecipientPolicy } from './recipient-policy';

export interface PaymentRequestEmail {
  reference: string;
  months: number;
  amount: number;
  currency: string;
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
    this.from =
      config.get<string>('RESEND_FROM_EMAIL') ??
      'TableQR <onboarding@resend.dev>';
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
        'Merci de vous être inscrit sur TableQR. Confirmez votre adresse email pour activer votre compte.',
        'Confirmer mon email',
        link,
        'Ce lien expire dans 24 heures.',
      ),
      link,
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
        'Ce lien expire dans 1 heure.',
      ),
      link,
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

  private async send(
    to: string | string[],
    subject: string,
    html: string,
    link: string,
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

    const allowed = all.filter((address) => this.recipients.allows(address));
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
      html,
    });
    if (error) {
      this.logger.error(
        `Resend failed for ${allowed.map(maskRecipient).join(', ')}: ${error.message}`,
      );
      throw new Error('Email delivery failed');
    }
  }
}

function layout(
  greeting: string,
  body: string,
  cta: string,
  link: string,
  footer: string,
) {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:Arial,sans-serif;color:#2b2b2b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:bold;padding-bottom:16px">TableQR</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${greeting}<br><br>${body}</td></tr>
<tr><td style="padding:24px 0"><a href="${link}" style="background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold;display:inline-block">${cta}</a></td></tr>
<tr><td style="font-size:12px;color:#777">${footer}<br>Lien direct : <a href="${link}" style="color:#777">${link}</a></td></tr>
</table></td></tr></table></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
