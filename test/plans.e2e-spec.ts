import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

const noThrottling = {
  increment: () =>
    Promise.resolve({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    }),
};

// Every send* and notify* method resolves without sending anything.
const silentMail = new Proxy(
  {},
  {
    get: (_, prop) =>
      typeof prop === 'string' && /^(send|notify)/.test(prop)
        ? () => Promise.resolve(undefined)
        : undefined,
  },
);

// Listed in ADMIN_EMAILS by e2e-env.ts.
const ADMIN_EMAIL = 'plans-admin@example.com';

// The three plans and what each unlocks (P0-03).
describe('Plans and entitlements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emails: string[] = [ADMIN_EMAIL];
  let owner = '';
  let ownerId = '';
  let admin = '';
  let slug = '';
  let tableToken = '';
  let dishId = '';
  const session = `s-${randomUUID()}`;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(noThrottling)
      .overrideProvider(MailService)
      .useValue(silentMail)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
    const adminUser = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: 'not-used',
        fullName: 'Admin',
        emailVerifiedAt: new Date(),
      },
    });
    admin = await jwt.signAsync({ sub: adminUser.id, ver: 0, mfa: true });

    const email = `plan-${randomUUID()}@example.com`;
    emails.push(email);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'not-used',
        fullName: 'Owner',
        emailVerifiedAt: new Date(),
      },
    });
    ownerId = user.id;
    owner = await jwt.signAsync({ sub: user.id, ver: 0 });
    slug = `plan-${randomUUID().slice(0, 8)}`;
    await http()
      .post('/restaurant')
      .set(bearer(owner))
      .send({ name: 'Plan test', slug })
      .expect(201);
    const category = await http()
      .post('/categories')
      .set(bearer(owner))
      .send({ name: 'Boissons' })
      .expect(201);
    const dish = await http()
      .post('/dishes')
      .set(bearer(owner))
      .send({ categoryId: category.body.id, name: 'Café', price: 2.5 })
      .expect(201);
    dishId = dish.body.id;
    await http()
      .post('/tables/bulk')
      .set(bearer(owner))
      .send({ count: 1 })
      .expect(201);
    tableToken = (await http().get('/tables').set(bearer(owner))).body[0].token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('gives a 14-day Standard trial and lists the three plans', async () => {
    const sub = await http()
      .get('/subscription')
      .set(bearer(owner))
      .expect(200);
    expect(sub.body).toMatchObject({
      status: 'trialing',
      plan: 'standard',
      entitlements: {
        ordering: false,
        serviceCalls: false,
        loyalty: false,
        counterSales: false,
        stock: false,
        maxStaff: 0,
        locales: ['fr', 'ar'],
      },
    });
    const trialDays =
      (new Date(sub.body.trialEndsAt).getTime() - Date.now()) / 86_400_000;
    expect(trialDays).toBeGreaterThan(13.9);
    expect(trialDays).toBeLessThanOrEqual(14);
    expect(
      sub.body.catalog.map(
        (p: { id: string; pricePerMonth: number; offers: unknown[] }) => [
          p.id,
          p.pricePerMonth,
          p.offers,
        ],
      ),
    ).toEqual([
      [
        'standard',
        49,
        [
          { months: 1, amount: 49 },
          { months: 12, amount: 490 },
        ],
      ],
      [
        'premium',
        99,
        [
          { months: 1, amount: 99 },
          { months: 12, amount: 990 },
        ],
      ],
      [
        'business',
        179,
        [
          { months: 1, amount: 179 },
          { months: 12, amount: 1790 },
        ],
      ],
    ]);

    // Ordering is a Premium feature, even during the trial.
    await http()
      .patch('/restaurant')
      .set(bearer(owner))
      .send({ orderingEnabled: true })
      .expect(403);
    const menu = await http().get(`/public/menu/${slug}`).expect(200);
    expect(menu.body.features).toEqual({
      serviceCalls: false,
      ordering: false,
    });
  });

  it('sells Premium: ordering and staff, but not counter sales', async () => {
    await http()
      .post('/subscription/payment-requests')
      .set(bearer(owner))
      .send({ plan: 'gold', months: 12, contactMethod: 'PHONE' })
      .expect(400);
    const created = await http()
      .post('/subscription/payment-requests')
      .set(bearer(owner))
      .send({ plan: 'premium', months: 12, contactMethod: 'PHONE' })
      .expect(201);
    expect(created.body).toMatchObject({ plan: 'premium', amount: 990 });
    await http()
      .post(`/admin/payment-requests/${created.body.id}/mark-paid`)
      .set(bearer(admin))
      .send({})
      .expect(200);

    const sub = await http()
      .get('/subscription')
      .set(bearer(owner))
      .expect(200);
    expect(sub.body).toMatchObject({
      status: 'active',
      plan: 'premium',
      paidPlan: 'premium',
      entitlements: { ordering: true, counterSales: false, maxStaff: 5 },
    });
    await http()
      .patch('/restaurant')
      .set(bearer(owner))
      .send({ orderingEnabled: true, enabledLocales: ['fr', 'ar', 'en'] })
      .expect(200);

    // Table ordering and the caisse work…
    const order = await http()
      .post(`/public/menu/${slug}/orders`)
      .send({
        sessionId: session,
        tableToken,
        items: [{ dishId, quantity: 1 }],
      })
      .expect(201);
    await http()
      .post(`/orders/${order.body.id}/accept`)
      .set(bearer(owner))
      .expect(200);
    await http().get('/orders/tabs').set(bearer(owner)).expect(200);
    // …counter sales and the daily closing belong to Business.
    const counter = await http()
      .post('/orders/counter')
      .set(bearer(owner))
      .send({ items: [{ dishId, quantity: 1 }] })
      .expect(403);
    expect(counter.body).toMatchObject({
      code: 'PLAN_REQUIRED',
      requiredPlan: 'business',
    });
    await http().get('/orders/report/day').set(bearer(owner)).expect(403);

    // Five staff members, not six.
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/staff')
        .set(bearer(owner))
        .send({ name: `Staff ${i}`, role: 'WAITER', pin: `100${i}` })
        .expect(201);
    }
    const sixth = await http()
      .post('/staff')
      .set(bearer(owner))
      .send({ name: 'Staff 6', role: 'WAITER', pin: '1006' })
      .expect(403);
    expect(sixth.body.requiredPlan).toBe('business');
  });

  it('locks the Premium features on Standard', async () => {
    await http()
      .post(`/admin/accounts/${ownerId}/plan`)
      .set(bearer(owner))
      .send({ plan: 'standard' })
      .expect(404);
    await http()
      .post(`/admin/accounts/${ownerId}/plan`)
      .set(bearer(admin))
      .send({ plan: 'standard' })
      .expect(200);

    const menu = await http().get(`/public/menu/${slug}`).expect(200);
    expect(menu.body.features).toEqual({
      serviceCalls: false,
      ordering: false,
    });
    expect(menu.body.restaurant.enabledLocales.sort()).toEqual(['ar', 'fr']);
    expect(menu.body.restaurant.orderingEnabled).toBe(false);

    const call = await http()
      .post(`/public/menu/${slug}/service`)
      .send({ sessionId: session, type: 'WAITER', tableToken })
      .expect(403);
    expect(call.body).toMatchObject({
      code: 'PLAN_REQUIRED',
      requiredPlan: 'premium',
    });
    await http()
      .post(`/public/menu/${slug}/orders`)
      .send({
        sessionId: session,
        tableToken,
        items: [{ dishId, quantity: 1 }],
      })
      .expect(403);
    await http().get('/orders').set(bearer(owner)).expect(403);

    await http()
      .patch('/restaurant')
      .set(bearer(owner))
      .send({ enabledLocales: ['fr', 'en'] })
      .expect(403);
    await http()
      .patch('/restaurant')
      .set(bearer(owner))
      .send({ enabledLocales: ['fr', 'ar'] })
      .expect(200);
    await http()
      .patch('/restaurant')
      .set(bearer(owner))
      .send({ orderingEnabled: true })
      .expect(403);

    // The team space closes with the plan.
    await http()
      .post('/staff-auth/login')
      .send({ restaurant: slug, pin: '1000' })
      .expect(403);
    const accounts = await http()
      .get('/admin/accounts')
      .set(bearer(admin))
      .expect(200);
    const row = accounts.body.find((a: { id: string }) => a.id === ownerId);
    expect(row.subscription).toMatchObject({ plan: 'standard' });
  });

  it('lets the admin record a Business payment directly', async () => {
    await http()
      .post(`/admin/accounts/${ownerId}/payments`)
      .set(bearer(admin))
      .send({ months: 1, plan: 'business' })
      .expect(200);
    const sub = await http()
      .get('/subscription')
      .set(bearer(owner))
      .expect(200);
    expect(sub.body).toMatchObject({ plan: 'business', paidPlan: 'business' });
    await http().get('/orders/report/day').set(bearer(owner)).expect(200);
    const payments = await http()
      .get(`/admin/accounts/${ownerId}/payments`)
      .set(bearer(admin))
      .expect(200);
    expect(payments.body[0]).toMatchObject({ plan: 'business', amount: 179 });
  });
});
