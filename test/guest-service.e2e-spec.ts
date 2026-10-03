import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
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

// Tables, service calls, sold-out, translations, feedback and owner stats
// (P1-01, P1-04, P1-05, P1-06, P1-03, P1-08, P1-09), plus tenant isolation.
describe('Guest service (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const owners: { email: string; token: string; slug: string }[] = [];
  const session = `s-${randomUUID()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(noThrottling)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    for (let i = 0; i < 2; i++) {
      const email = `svc-${randomUUID()}@example.com`;
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'not-used',
          fullName: `Owner ${i}`,
          emailVerifiedAt: new Date(),
        },
      });
      const token = await jwt.signAsync({ sub: user.id, ver: 0 });
      const slug = `svc-${randomUUID().slice(0, 8)}`;
      await request(app.getHttpServer())
        .post('/restaurant')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Resto ${i}`, slug })
        .expect(201);
      owners.push({ email, token, slug });
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            ...owners.map((o) => o.email),
            'svc-admin@example.com',
            'svc-new-owner@example.com',
          ],
        },
      },
    });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = (i: number) => ({ Authorization: `Bearer ${owners[i].token}` });

  let tables: { id: string; label: string; token: string }[] = [];
  let dishId = '';

  it('creates tables in bulk with continuing labels', async () => {
    await http()
      .post('/tables/bulk')
      .set(as(0))
      .send({ count: 3, zone: 'Salle' })
      .expect(201);
    const res = await http()
      .post('/tables/bulk')
      .set(as(0))
      .send({ count: 2, zone: 'Terrasse' })
      .expect(201);
    tables = res.body;
    expect(tables.map((t) => t.label)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
    expect(new Set(tables.map((t) => t.token)).size).toBe(5);
    // Other owners see none of them.
    const other = await http().get('/tables').set(as(1)).expect(200);
    expect(other.body).toEqual([]);
  });

  it('serves the menu with the table from the QR code', async () => {
    const category = await http()
      .post('/categories')
      .set(as(0))
      .send({ name: 'Plats' })
      .expect(201);
    const dish = await http()
      .post('/dishes')
      .set(as(0))
      .send({ categoryId: category.body.id, name: 'Brik', price: 4.5 })
      .expect(201);
    dishId = dish.body.id;

    const res = await http()
      .get(`/public/menu/${owners[0].slug}?t=${tables[0].token}`)
      .expect(200);
    expect(res.body.table).toEqual({ label: 'T1', zone: 'Salle' });
    expect(res.body.tables).toHaveLength(5);
    expect(JSON.stringify(res.body)).not.toContain(tables[1].token);
  });

  let requestId = '';

  it('calls a waiter once per table within the cooldown', async () => {
    const body = {
      sessionId: session,
      type: 'WAITER',
      tableToken: tables[0].token,
    };
    const first = await http()
      .post(`/public/menu/${owners[0].slug}/service`)
      .send(body)
      .expect(201);
    const second = await http()
      .post(`/public/menu/${owners[0].slug}/service`)
      .send(body)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
    requestId = first.body.id;

    await http()
      .post(`/public/menu/${owners[0].slug}/service`)
      .send({ sessionId: session, type: 'BILL_CASH' })
      .expect(400);
    await http()
      .post(`/public/menu/${owners[0].slug}/service`)
      .send({ sessionId: session, type: 'BILL_CASH', tableLabel: 'T2' })
      .expect(201);
  });

  it('lets only the owning restaurant handle a request', async () => {
    await http()
      .post(`/service-requests/${requestId}/acknowledge`)
      .set(as(1))
      .expect(404);
    const list = await http().get('/service-requests').set(as(0)).expect(200);
    expect(list.body.map((r: { table: string }) => r.table)).toEqual([
      'T1',
      'T2',
    ]);
    await http()
      .post(`/service-requests/${requestId}/acknowledge`)
      .set(as(0))
      .expect(201);
    await http()
      .post(`/service-requests/${requestId}/done`)
      .set(as(0))
      .expect(201);
    const status = await http()
      .get(`/public/menu/${owners[0].slug}/service/${requestId}`)
      .query({ sessionId: session })
      .expect(200);
    expect(status.body.status).toBe('DONE');
    await http()
      .get(`/public/menu/${owners[0].slug}/service/${requestId}`)
      .query({ sessionId: 'someone-else-123' })
      .expect(403);
  });

  it('invalidates only the rotated table QR', async () => {
    await http()
      .post(`/tables/${tables[0].id}/rotate-token`)
      .set(as(0))
      .expect(201);
    const old = await http()
      .get(`/public/menu/${owners[0].slug}?t=${tables[0].token}`)
      .expect(200);
    expect(old.body.table).toBeNull();
    const other = await http()
      .get(`/public/menu/${owners[0].slug}?t=${tables[1].token}`)
      .expect(200);
    expect(other.body.table.label).toBe('T2');
  });

  it('marks a dish sold out until tomorrow and back', async () => {
    await http()
      .patch(`/dishes/${dishId}`)
      .set(as(0))
      .send({ soldOut: true })
      .expect(200);
    let menu = await http().get(`/public/menu/${owners[0].slug}`).expect(200);
    const dish = menu.body.categories[0].dishes[0];
    expect(dish.soldOut).toBe(true);
    expect(new Date(dish.soldOutUntil).getUTCHours()).toBe(4);

    await http()
      .patch(`/dishes/${dishId}`)
      .set(as(0))
      .send({ soldOut: false })
      .expect(200);
    menu = await http().get(`/public/menu/${owners[0].slug}`).expect(200);
    expect(menu.body.categories[0].dishes[0].soldOut).toBe(false);
  });

  it('stores translations and flags them for review when French changes', async () => {
    const res = await http()
      .patch(`/dishes/${dishId}`)
      .set(as(0))
      .send({ nameI18n: { en: 'Brik — crispy pastry', xx: 'ignored' } })
      .expect(200);
    expect(res.body.nameI18n).toEqual({ en: 'Brik — crispy pastry' });
    const renamed = await http()
      .patch(`/dishes/${dishId}`)
      .set(as(0))
      .send({ name: 'Brik au thon' })
      .expect(200);
    expect(renamed.body.aiLocales).toEqual(['en']);
  });

  it('records feedback with tags and the table, whatever the rating', async () => {
    await http()
      .post(`/public/menu/${owners[0].slug}/feedback`)
      .send({
        rating: 2,
        tags: ['attente'],
        comment: 'Trop long',
        tableToken: tables[1].token,
        sessionId: session,
        contactConsent: false,
        contact: 'should-not-be-kept@example.com',
      })
      .expect(201);
    const list = await http()
      .get('/restaurants/feedback')
      .set(as(0))
      .expect(200);
    expect(list.body[0]).toMatchObject({
      rating: 2,
      tags: ['attente'],
      tableLabel: 'T2',
      contact: null,
    });
  });

  it('counts guest events in the owner overview', async () => {
    await http()
      .post(`/public/menu/${owners[0].slug}/events`)
      .send({
        sessionId: session,
        events: [
          { type: 'menu_opened', props: { locale: 'ar' } },
          { type: 'item_viewed', itemId: dishId },
          { type: 'google_review_clicked' },
          { type: 'not_a_real_event' },
        ],
      })
      .expect(204);
    const res = await http().get('/stats/overview').set(as(0)).expect(200);
    expect(res.body).toMatchObject({
      menuOpens: 1,
      guestSessions: 1,
      googleReviewClicks: 1,
      serviceRequests: 2,
      serviceHandled: 1,
      feedbackCount: 1,
    });
    expect(res.body.languages).toEqual([{ locale: 'ar', count: 1 }]);
    const other = await http().get('/stats/overview').set(as(1)).expect(200);
    expect(other.body.menuOpens).toBe(0);
  });

  it('shows platform activity and system state to the admin only', async () => {
    await http().get('/admin/activity').set(as(0)).expect(404);
    await http().get('/admin/system').set(as(0)).expect(404);

    await prisma.user.deleteMany({ where: { email: 'svc-admin@example.com' } });
    const admin = await prisma.user.create({
      data: {
        email: 'svc-admin@example.com',
        passwordHash: 'not-used',
        fullName: 'Platform admin',
        emailVerifiedAt: new Date(),
      },
    });
    const asAdmin = {
      Authorization: `Bearer ${await app.get(JwtService).signAsync({ sub: admin.id, ver: 0, mfa: true })}`,
    };

    const res = await http()
      .get('/admin/activity?days=7')
      .set(asAdmin)
      .expect(200);
    const row = res.body.restaurants.find(
      (r: { slug: string }) => r.slug === owners[0].slug,
    );
    expect(row).toMatchObject({
      visits: 1,
      requests: 2,
      feedback: 1,
      avgRating: 2,
      adoption: { tables: expect.any(Number) },
    });
    expect(res.body.daily).toHaveLength(7);
    expect(res.body.totals.lowRatings).toBeGreaterThanOrEqual(1);
    // Guest contact details never reach the platform view.
    expect(JSON.stringify(res.body.recentFeedback)).not.toContain('contact');

    await http().get('/admin/activity?days=5').set(asAdmin).expect(400);

    const system = await http().get('/admin/system').set(asAdmin).expect(200);
    expect(system.body).toMatchObject({
      database: { ok: true },
      liveBoardConnections: expect.any(Number),
      integrations: { ai: expect.any(Boolean) },
    });
    expect(JSON.stringify(system.body)).not.toMatch(/sk-|re_|secret/i);
  });

  it('keeps admin and restaurant accounts apart', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: 'svc-admin@example.com' },
    });
    const asAdmin = {
      Authorization: `Bearer ${await app.get(JwtService).signAsync({ sub: admin.id, ver: 0, mfa: true })}`,
    };

    const me = await http().get('/auth/me').set(asAdmin).expect(200);
    expect(me.body).toMatchObject({ role: 'admin', isAdmin: true });
    const owner = await http().get('/auth/me').set(as(0)).expect(200);
    expect(owner.body).toMatchObject({ role: 'restaurant', isAdmin: false });

    // An admin account cannot use restaurant endpoints, nor create a restaurant.
    await http().get('/tables').set(asAdmin).expect(403);
    await http().get('/service-requests').set(asAdmin).expect(403);
    await http()
      .post('/restaurant')
      .set(asAdmin)
      .send({ name: 'Admin resto', slug: `adm-${randomUUID().slice(0, 8)}` })
      .expect(403);
    // A restaurant account cannot use the console.
    await http().get('/admin/overview').set(as(0)).expect(404);
    await http().get('/admin/payment-requests').set(as(0)).expect(404);
    await http().post('/auth/admin-mfa/setup').set(as(0)).expect(404);
  });

  it('opens a restaurant account and moves a restaurant off an admin account', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: 'svc-admin@example.com' },
    });
    const asAdmin = {
      Authorization: `Bearer ${await app.get(JwtService).signAsync({ sub: admin.id, ver: 0, mfa: true })}`,
    };
    // A restaurant set up under the admin account before roles existed.
    const slug = `adm-${randomUUID().slice(0, 8)}`;
    await prisma.restaurant.create({
      data: { userId: admin.id, name: 'Pitch resto', slug },
    });
    await prisma.subscription.create({
      data: {
        userId: admin.id,
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 86_400_000),
      },
    });

    // Only restaurants owned by an admin account can be taken over.
    await http()
      .post('/admin/accounts')
      .set(asAdmin)
      .send({
        fullName: 'Thief',
        email: 'svc-thief@example.com',
        password: 'long-enough-1',
        takeOverSlug: owners[1].slug,
      })
      .expect(409);
    await http()
      .post('/admin/accounts')
      .set(asAdmin)
      .send({
        fullName: 'X',
        email: 'svc-admin@example.com',
        password: 'long-enough-1',
      })
      .expect(400);

    const res = await http()
      .post('/admin/accounts')
      .set(asAdmin)
      .send({
        fullName: 'New Owner',
        email: 'SVC-New-Owner@example.com',
        password: 'long-enough-1',
        takeOverSlug: slug,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      email: 'svc-new-owner@example.com',
      restaurantMoved: true,
    });

    const login = await http()
      .post('/auth/login')
      .send({ email: 'svc-new-owner@example.com', password: 'long-enough-1' })
      .expect(200);
    const asNew = { Authorization: `Bearer ${login.body.token}` };
    const restaurant = await http().get('/restaurant').set(asNew).expect(200);
    expect(restaurant.body.slug).toBe(slug);
    expect(
      await prisma.subscription.count({ where: { userId: res.body.id } }),
    ).toBe(1);
    expect(await prisma.restaurant.count({ where: { userId: admin.id } })).toBe(
      0,
    );
  });
});
