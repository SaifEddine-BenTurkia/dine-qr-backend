import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(config: ConfigService) {
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

  private async send(to: string, subject: string, html: string, link: string) {
    if (!this.resend) {
      // Development without a Resend key: the link is all you need to continue.
      this.logger.warn(`RESEND_API_KEY not set; email to ${to}: ${link}`);
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
    });
    if (error) {
      this.logger.error(`Resend failed for ${to}: ${error.message}`);
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
