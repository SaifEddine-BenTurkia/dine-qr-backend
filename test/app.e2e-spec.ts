import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
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
  sent: string[] = [];
  notifyAdminsOfPaymentRequest(to: string[]) {
    this.sent.push(`admins:${to.join(',')}`);
    return Promise.resolve();
  }
  sendPaymentRequestReceived(to: string) {
    this.sent.push(`received:${to}`);
    return Promise.resolve();
  }
  sendPaymentConfirmed(to: string) {
    this.sent.push(`confirmed:${to}`);
    return Promise.resolve();
  }
  sendPaymentRejected(to: string) {
    this.sent.push(`rejected:${to}`);
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

// Listed in ADMIN_EMAILS by e2e-env.ts.
const ADMIN_EMAIL = 'e2e-admin@example.com';

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
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [email, ADMIN_EMAIL] } },
    });
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
    // Lists are simply empty before setup, not errors.
    const noCategories = await http()
      .get('/categories')
      .set(authed())
      .expect(200);
    expect(noCategories.body).toEqual([]);
    await http().get('/stats/scans?days=7').set(authed()).expect(200);
    // Creating something still explains what is missing.
    await http()
      .post('/categories')
      .set(authed())
      .send({ name: 'Boissons' })
      .expect(404);

    await http()
      .post('/restaurant')
      .set(authed())
      .send({ name: 'Chez Amine', slug, primaryColor: '#c2410c' })
      .expect(201);
    const taken = await http()
      .get(`/restaurant/slug-available?slug=${slug}`)
      .set(authed())
      .expect(200);
    expect(taken.body).toEqual({ available: true }); // own address
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

    // Creating the restaurant started the free trial: the menu is live.
    const trial = await http().get('/subscription').set(authed()).expect(200);
    expect(trial.body).toMatchObject({
      status: 'trialing',
      currency: 'TND',
      pricePerMonth: 49,
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

  it('queues a cash payment that only an admin can confirm', async () => {
    const created = await http()
      .post('/subscription/payment-requests')
      .set(authed())
      .send({ months: 12, contactMethod: 'WHATSAPP', note: 'Je passe demain' })
      .expect(201);
    expect(created.body).toMatchObject({
      months: 12,
      amount: 490,
      currency: 'TND',
      status: 'PENDING',
    });
    expect(created.body.reference).toMatch(/^TQ-[A-Z2-9]{6}$/);
    expect(mail.sent).toEqual(
      expect.arrayContaining([`admins:${ADMIN_EMAIL}`, `received:${email}`]),
    );

    // One open request at a time; months must be an offered plan.
    await http()
      .post('/subscription/payment-requests')
      .set(authed())
      .send({ months: 1, contactMethod: 'EMAIL' })
      .expect(409);

    const sub = await http().get('/subscription').set(authed()).expect(200);
    expect(sub.body.pendingRequest.reference).toBe(created.body.reference);
    expect(sub.body.plans).toEqual([
      { months: 1, amount: 49 },
      { months: 12, amount: 490 },
    ]);
    // Only offered durations can be requested.
    await http()
      .post('/subscription/payment-requests')
      .set(authed())
      .send({ months: 3, contactMethod: 'EMAIL' })
      .expect(400);
    const trialEndsAt = new Date(sub.body.trialEndsAt);

    // Owners cannot reach the admin queue.
    await http().get('/admin/payment-requests').set(authed()).expect(403);

    const admin = await http()
      .post('/auth/register')
      .send({
        email: ADMIN_EMAIL,
        password: 'admin-password',
        fullName: 'Admin',
      })
      .expect(201);
    await http()
      .get(`/auth/verify-email?token=${mail.verification.get(ADMIN_EMAIL)}`)
      .expect(200);
    const asAdmin = { Authorization: `Bearer ${admin.body.token}` };
    const me = await http().get('/auth/me').set(asAdmin).expect(200);
    expect(me.body.isAdmin).toBe(true);

    const queue = await http()
      .get('/admin/payment-requests?status=PENDING')
      .set(asAdmin)
      .expect(200);
    expect(queue.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: created.body.reference,
          owner: expect.objectContaining({ email }),
          restaurant: expect.objectContaining({ slug }),
        }),
      ]),
    );

    await http()
      .post(`/admin/payment-requests/${created.body.id}/mark-paid`)
      .set(asAdmin)
      .send({ amountReceived: 490, adminNote: 'Espèces reçues' })
      .expect(200);
    // A second click cannot extend the subscription twice.
    await http()
      .post(`/admin/payment-requests/${created.body.id}/mark-paid`)
      .set(asAdmin)
      .send({})
      .expect(409);
    expect(mail.sent).toContain(`confirmed:${email}`);

    // Paid months are added after the remaining trial, not from today.
    const paid = await http().get('/subscription').set(authed()).expect(200);
    expect(paid.body.status).toBe('active');
    expect(paid.body.pendingRequest).toBeNull();
    const periodEnd = new Date(paid.body.currentPeriodEnd);
    const monthsAfterTrial =
      (periodEnd.getUTCFullYear() - trialEndsAt.getUTCFullYear()) * 12 +
      periodEnd.getUTCMonth() -
      trialEndsAt.getUTCMonth();
    expect(monthsAfterTrial).toBe(12);
    await http().get(`/public/menu/${slug}`).expect(200);

    // Admin dashboard: overview, account list and direct actions.
    const overview = await http()
      .get('/admin/overview')
      .set(asAdmin)
      .expect(200);
    expect(overview.body.revenue.total).toBeGreaterThanOrEqual(490);
    expect(overview.body.pricing.plans).toHaveLength(2);
    await http().get('/admin/overview').set(authed()).expect(403);

    const accounts = await http()
      .get(`/admin/accounts?search=${encodeURIComponent(email)}`)
      .set(asAdmin)
      .expect(200);
    expect(accounts.body).toHaveLength(1);
    const ownerAccount = accounts.body[0];
    expect(ownerAccount).toMatchObject({
      email,
      restaurant: expect.objectContaining({ slug, dishes: 2 }),
      subscription: expect.objectContaining({ status: 'active' }),
      payments: expect.objectContaining({ count: 1, totalPaid: 490 }),
    });

    // A trial cannot be given on top of a paid period.
    await http()
      .post(`/admin/accounts/${ownerAccount.id}/extend-trial`)
      .set(asAdmin)
      .send({ days: 7 })
      .expect(409);
    // Cash at the counter, without a request from the owner.
    await http()
      .post(`/admin/accounts/${ownerAccount.id}/payments`)
      .set(asAdmin)
      .send({ months: 1, adminNote: 'Payé au comptoir' })
      .expect(200);
    const history = await http()
      .get(`/admin/accounts/${ownerAccount.id}/payments`)
      .set(asAdmin)
      .expect(200);
    expect(
      history.body.filter((r: { status: string }) => r.status === 'PAID'),
    ).toHaveLength(2);

    // Suspension takes the menu offline; a gifted trial brings it back.
    await http()
      .post(`/admin/accounts/${ownerAccount.id}/suspend`)
      .set(asAdmin)
      .expect(200);
    await http().get(`/public/menu/${slug}`).expect(402);
    await http()
      .post(`/admin/accounts/${ownerAccount.id}/extend-trial`)
      .set(asAdmin)
      .send({ days: 7 })
      .expect(200);
    await http().get(`/public/menu/${slug}`).expect(200);

    // The owner can withdraw a request they no longer need.
    const another = await http()
      .post('/subscription/payment-requests')
      .set(authed())
      .send({ months: 1, contactMethod: 'PHONE' })
      .expect(201);
    await http()
      .post(`/subscription/payment-requests/${another.body.id}/cancel`)
      .set(authed())
      .expect(204);
    await http()
      .post(`/subscription/payment-requests/${another.body.id}/cancel`)
      .set(authed())
      .expect(404);
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
