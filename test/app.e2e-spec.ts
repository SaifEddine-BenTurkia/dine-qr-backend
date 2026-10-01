import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Runs against a real, migrated Postgres (DATABASE_URL), as CI does.
// Emails are captured instead of sent so the test can follow the links.
class CapturingMail {
  verification = new Map<string, string>();
  reset = new Map<string, string>();
  sendEmailVerification(to: string, _name: string, token: string) {
    this.verification.set(to, token);
    return Promise.resolve();
  }
  sendPasswordReset(to: string, _name: string, token: string) {
    this.reset.set(to, token);
    return Promise.resolve();
  }
}

// Unlimited rate limiting: the suite makes many requests from one address.
const noThrottling = {
  increment: () =>
    Promise.resolve({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    }),
};

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET ?? '';

describe('TableQR API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const mail = new CapturingMail();
  const email = `owner-${randomUUID()}@example.com`;
  const slug = `resto-${randomUUID().slice(0, 8)}`;
  let token = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .overrideProvider(ThrottlerStorage)
      .useValue(noThrottling)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const authed = () => ({ Authorization: `Bearer ${token}` });

  it('reports health', async () => {
    await http().get('/health/ready').expect(200);
  });

  it('registers, then blocks the dashboard until the email is verified', async () => {
    const res = await http()
      .post('/auth/register')
      .send({
        email,
        password: 'correct-horse',
        fullName: 'Amine Ben Ali',
        country: 'TN',
      })
      .expect(201);
    token = res.body.token;
    expect(res.body.user).toMatchObject({ email, emailVerified: false });

    await http().get('/auth/me').set(authed()).expect(200);
    await http().get('/restaurant').set(authed()).expect(403);

    await http()
      .get(`/auth/verify-email?token=${mail.verification.get(email)}`)
      .expect(200);
    // The link only works once.
    await http()
      .get(`/auth/verify-email?token=${mail.verification.get(email)}`)
      .expect(400);
  });

  it('rejects bad credentials with a readable message', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    expect(typeof res.body.message).toBe('string');
  });

  it('returns a single validation message string', async () => {
    const res = await http()
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'x', fullName: '' })
      .expect(400);
    expect(typeof res.body.message).toBe('string');
  });

  it('returns JSON null before the restaurant exists, then creates it', async () => {
    const empty = await http().get('/restaurant').set(authed()).expect(200);
    expect(empty.text).toBe('null');

    await http()
      .post('/restaurant')
      .set(authed())
      .send({ name: 'Chez Amine', slug, primaryColor: '#c2410c' })
      .expect(201);
  });

  it('builds a menu and serves it publicly only with a live subscription', async () => {
    const drinks = await http()
      .post('/categories')
      .set(authed())
      .send({ name: 'Boissons' })
      .expect(201);
    const mains = await http()
      .post('/categories')
      .set(authed())
      .send({ name: 'Plats' })
      .expect(201);
    expect(mains.body.position).toBe(drinks.body.position + 1);

    await http()
      .post('/dishes')
      .set(authed())
      .send({
        categoryId: mains.body.id,
        name: 'Couscous',
        price: 18.5,
        available: true,
      })
      .expect(201);
    await http()
      .post('/dishes')
      .set(authed())
      .send({
        categoryId: mains.body.id,
        name: 'Hidden',
        price: 1,
        available: false,
      })
      .expect(201);

    await http()
      .post('/categories/reorder')
      .set(authed())
      .send({ ids: [mains.body.id, drinks.body.id] })
      .expect(204);

    await http().get(`/public/menu/${slug}`).expect(402);

    const trial = await http()
      .post('/subscription/start-trial')
      .set(authed())
      .expect(200);
    expect(trial.body).toMatchObject({
      status: 'trialing',
      currency: 'TND',
      pricePerMonth: 35,
    });
    await http().post('/subscription/start-trial').set(authed()).expect(409);

    const menu = await http().get(`/public/menu/${slug}`).expect(200);
    expect(menu.body.categories.map((c: { name: string }) => c.name)).toEqual([
      'Plats',
      'Boissons',
    ]);
    expect(menu.body.categories[0].dishes).toEqual([
      expect.objectContaining({ name: 'Couscous', price: 18.5 }),
    ]);
  });

  it('counts a scan once per visitor and reports daily stats', async () => {
    await http()
      .post(`/public/menu/${slug}/scan`)
      .set('CF-Connecting-IP', '203.0.113.7')
      .expect(204);
    await http()
      .post(`/public/menu/${slug}/scan`)
      .set('CF-Connecting-IP', '203.0.113.7')
      .expect(204);
    await http()
      .post(`/public/menu/${slug}/scan`)
      .set('CF-Connecting-IP', '203.0.113.8')
      .expect(204);

    const stats = await http()
      .get('/stats/scans?days=7')
      .set(authed())
      .expect(200);
    expect(stats.body).toHaveLength(7);
    expect(stats.body[6].count).toBe(2);
  });

  it('collects and lists feedback', async () => {
    await http()
      .post(`/public/menu/${slug}/feedback`)
      .send({ rating: 5, comment: 'Excellent' })
      .expect(201);
    const list = await http()
      .get('/restaurants/feedback')
      .set(authed())
      .expect(200);
    expect(list.body[0]).toMatchObject({ rating: 5, comment: 'Excellent' });
  });

  it('applies signed Paddle webhooks once and rejects unsigned ones', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const event = {
      event_id: `evt_${randomUUID()}`,
      event_type: 'subscription.activated',
      occurred_at: new Date().toISOString(),
      data: {
        id: `sub_${randomUUID()}`,
        status: 'active',
        customer_id: 'ctm_test',
        updated_at: new Date().toISOString(),
        custom_data: { userId: user.id },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        },
        scheduled_change: null,
      },
    };
    const body = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const h1 = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${ts}:${body}`)
      .digest('hex');

    await http()
      .post('/webhooks/paddle')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(401);

    for (let i = 0; i < 2; i++) {
      await http()
        .post('/webhooks/paddle')
        .set('Content-Type', 'application/json')
        .set('Paddle-Signature', `ts=${ts};h1=${h1}`)
        .send(body)
        .expect(200);
    }

    const sub = await http().get('/subscription').set(authed()).expect(200);
    expect(sub.body.status).toBe('active');
  });

  it('resets the password and signs out older sessions', async () => {
    await http().post('/auth/forgot-password').send({ email }).expect(200);
    await http()
      .post('/auth/reset-password')
      .send({ token: mail.reset.get(email), password: 'new-password-123' })
      .expect(200);

    await http().get('/auth/me').set(authed()).expect(401);
    await http()
      .post('/auth/login')
      .send({ email, password: 'new-password-123' })
      .expect(200);
  });
});
