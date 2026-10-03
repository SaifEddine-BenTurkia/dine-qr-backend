import { ConfigService } from '@nestjs/config';
import { layout, MailService } from './mail.service';
import { RecipientPolicy } from './recipient-policy';

describe('email layout', () => {
  const message = layout(
    'Bonjour Amine,',
    'Votre lien :<br>cliquez &amp; confirmez.',
    'Confirmer mon adresse',
    'https://menu.example/verify-email?token=abc',
    'Ce lien expire dans 24 heures.',
  );

  it('carries the link in the button and as text', () => {
    expect(message.html).toContain(
      'href="https://menu.example/verify-email?token=abc"',
    );
    expect(message.text).toContain(
      'Confirmer mon adresse : https://menu.example/verify-email?token=abc',
    );
  });

  it('has a plain text version without tags or entities', () => {
    expect(message.text).not.toMatch(/<[^>]+>/);
    expect(message.text).toContain('cliquez & confirmez.');
    expect(message.text.startsWith('Bonjour Amine,')).toBe(true);
  });
});

describe('MailService.sendTest', () => {
  it('says plainly when no Resend key is set', async () => {
    const config = new ConfigService({});
    const mail = new MailService(config, new RecipientPolicy(config));
    expect(mail.configured).toBe(false);
    const result = await mail.sendTest('admin@example.com');
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('RESEND_API_KEY');
  });
});
