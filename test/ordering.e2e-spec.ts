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

// Staff accounts (P0-11 lean) and ordering with the caisse (O-01…O-05).
describe('Staff and ordering (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emails: string[] = [];
  const owner = { token: '', slug: '' };
  const other = { token: '', slug: '' };
  const session = `s-${randomUUID()}`;
  let tableToken = '';
  let tableId = '';
  const dishes: { id: string; price: number }[] = [];

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function makeOwner(target: { token: string; slug: string }) {
    const email = `ord-${randomUUID()}@example.com`;
    emails.push(email);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'not-used',
        fullName: 'Owner',
        emailVerifiedAt: new Date(),
      },
    });
    target.token = await app
      .get(JwtService)
      .signAsync({ sub: user.id, ver: 0 });
    target.slug = `ord-${randomUUID().slice(0, 8)}`;
    await http()
      .post('/restaurant')
      .set(bearer(target.token))
      .send({ name: 'Café test', slug: target.slug })
      .expect(201);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(noThrottling)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await makeOwner(owner);
    await makeOwner(other);

    const category = await http()
      .post('/categories')
      .set(bearer(owner.token))
      .send({ name: 'Boissons' })
      .expect(201);
    for (const [name, price] of [
      ['Café direct', '2,500'],
      ['Thé', 2],
      ['Citronnade', 4.5],
    ] as const) {
      const dish = await http()
        .post('/dishes')
        .set(bearer(owner.token))
        .send({
          categoryId: category.body.id,
          name,
          price: Number(String(price).replace(',', '.')),
        })
        .expect(201);
      dishes.push({ id: dish.body.id, price: dish.body.priceMillimes });
    }
    await http()
      .post('/tables/bulk')
      .set(bearer(owner.token))
      .send({ count: 2, zone: 'Salle' })
      .expect(201);
    const tables = await http().get('/tables').set(bearer(owner.token));
    tableToken = tables.body[0].token;
    tableId = tables.body[0].id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  let cashier = '';
  let waiter = '';

  it('lets the owner create staff with unique PINs and staff sign in', async () => {
    await http()
      .post('/staff')
      .set(bearer(owner.token))
      .send({ name: 'Sami', role: 'CASHIER', pin: '1234' })
      .expect(201);
    await http()
      .post('/staff')
      .set(bearer(owner.token))
      .send({ name: 'Nour', role: 'WAITER', pin: '1234' })
      .expect(409);
    await http()
      .post('/staff')
      .set(bearer(owner.token))
      .send({ name: 'Nour', role: 'WAITER', pin: '98' })
      .expect(400);
    const nour = await http()
      .post('/staff')
      .set(bearer(owner.token))
      .send({ name: 'Nour', role: 'WAITER', pin: '5678' })
      .expect(201);
    // The same PIN is fine in another restaurant.
    await http()
      .post('/staff')
      .set(bearer(other.token))
      .send({ name: 'Ali', role: 'CASHIER', pin: '1234' })
      .expect(201);

    await http()
      .post('/staff-auth/login')
      .send({ restaurant: owner.slug, pin: '0000' })
      .expect(401);
    const login = await http()
      .post('/staff-auth/login')
      .send({ restaurant: owner.slug.toUpperCase(), pin: '1234' })
      .expect(200);
    cashier = login.body.token;
    expect(login.body.staff).toMatchObject({
      name: 'Sami',
      role: 'CASHIER',
      restaurant: { slug: owner.slug },
    });
    waiter = (
      await http()
        .post('/staff-auth/login')
        .send({ restaurant: owner.slug, pin: '5678' })
        .expect(200)
    ).body.token;

    // Staff reach only what is meant for them.
    await http().get('/staff-auth/me').set(bearer(cashier)).expect(200);
    await http().get('/service-requests').set(bearer(waiter)).expect(200);
    await http().get('/tables').set(bearer(cashier)).expect(200);
    await http().get('/restaurant').set(bearer(cashier)).expect(403);
    await http().get('/staff').set(bearer(cashier)).expect(403);
    await http().get('/stats/overview').set(bearer(cashier)).expect(403);
    await http().get('/orders/tabs').set(bearer(waiter)).expect(403);
    await http().get('/admin/overview').set(bearer(cashier)).expect(404);

    // Deactivating a member ends their session at once.
    await http()
      .patch(`/staff/${nour.body.id}`)
      .set(bearer(owner.token))
      .send({ active: false })
      .expect(200);
    await http().get('/orders').set(bearer(waiter)).expect(401);
    await http()
      .patch(`/staff/${nour.body.id}`)
      .set(bearer(owner.token))
      .send({ active: true })
      .expect(200);
    waiter = (
      await http()
        .post('/staff-auth/login')
        .send({ restaurant: owner.slug, pin: '5678' })
        .expect(200)
    ).body.token;
  });

  it('refuses guest orders until ordering is on, and without the table QR', async () => {
    const order = {
      sessionId: session,
      tableToken,
      items: [{ dishId: dishes[0].id, quantity: 2 }],
    };
    await http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send(order)
      .expect(403);
    await http()
      .patch('/restaurant')
      .set(bearer(owner.token))
      .send({ orderingEnabled: true, taxId: '1234567/A/M/000' })
      .expect(200);
    await http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send({ ...order, tableToken: 'not-a-real-token' })
      .expect(400);
    const menu = await http().get(`/public/menu/${owner.slug}`).expect(200);
    expect(menu.body.restaurant.orderingEnabled).toBe(true);
  });

  let orderId = '';

  it('takes a guest order at server prices and tells the caisse', async () => {
    const res = await http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send({
        sessionId: session,
        tableToken,
        note: 'Vite svp',
        items: [
          { dishId: dishes[0].id, quantity: 2, note: 'sans sucre' },
          { dishId: dishes[2].id, quantity: 1 },
          // A dish of another restaurant is refused below.
        ],
      })
      .expect(201);
    orderId = res.body.id;
    expect(res.body).toMatchObject({
      status: 'PENDING',
      number: 1,
      table: { label: 'T1' },
      totalMillimes: 2 * 2500 + 4500,
      total: 9.5,
    });
    expect(res.body.items[0]).toMatchObject({
      name: 'Café direct',
      note: 'sans sucre',
    });

    // The guest cannot sneak in a dish from elsewhere or a sold-out one.
    const foreign = await prisma.dish.create({
      data: {
        name: 'Ailleurs',
        priceMillimes: 1000,
        position: 0,
        category: {
          create: {
            name: 'X',
            position: 0,
            restaurant: { connect: { slug: other.slug } },
          },
        },
      },
    });
    await http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send({
        sessionId: session,
        tableToken,
        items: [{ dishId: foreign.id, quantity: 1 }],
      })
      .expect(400);
    await http()
      .patch(`/dishes/${dishes[1].id}`)
      .set(bearer(owner.token))
      .send({ soldOut: true })
      .expect(200);
    await http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send({
        sessionId: session,
        tableToken,
        items: [{ dishId: dishes[1].id, quantity: 1 }],
      })
      .expect(409);

    const caisse = await http().get('/orders').set(bearer(cashier)).expect(200);
    expect(caisse.body.map((o: { id: string }) => o.id)).toContain(orderId);
    const elsewhere = await http()
      .get('/orders')
      .set(bearer(other.token))
      .expect(200);
    expect(elsewhere.body).toHaveLength(0);
  });

  it('moves the order through the kitchen and shows it to the guest', async () => {
    await http()
      .post(`/orders/${orderId}/accept`)
      .set(bearer(waiter))
      .expect(403);
    await http()
      .post(`/orders/${orderId}/ready`)
      .set(bearer(cashier))
      .expect(409);
    await http()
      .post(`/orders/${orderId}/accept`)
      .set(bearer(cashier))
      .expect(200);
    await http()
      .post(`/orders/${orderId}/accept`)
      .set(bearer(cashier))
      .expect(409);
    await http()
      .post(
        `/public/menu/${owner.slug}/orders/${orderId}/cancel?sessionId=${session}`,
      )
      .expect(409);
    await http()
      .post(`/orders/${orderId}/ready`)
      .set(bearer(waiter))
      .expect(200);
    const mine = await http()
      .get(`/public/menu/${owner.slug}/orders?sessionId=${session}`)
      .expect(200);
    expect(mine.body[0]).toMatchObject({ id: orderId, status: 'READY' });
    const stranger = await http()
      .get(`/public/menu/${owner.slug}/orders?sessionId=s-${randomUUID()}`)
      .expect(200);
    expect(stranger.body).toHaveLength(0);
  });

  it('lets the guest cancel while pending and the cashier reject', async () => {
    await http()
      .patch(`/dishes/${dishes[1].id}`)
      .set(bearer(owner.token))
      .send({ soldOut: false })
      .expect(200);
    const second = await http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send({
        sessionId: session,
        tableToken,
        items: [{ dishId: dishes[1].id, quantity: 1 }],
      })
      .expect(201);
    expect(second.body.number).toBe(2);
    await http()
      .post(
        `/public/menu/${owner.slug}/orders/${second.body.id}/cancel?sessionId=${session}`,
      )
      .expect(200);
    const third = await http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send({
        sessionId: session,
        tableToken,
        items: [{ dishId: dishes[1].id, quantity: 3 }],
      })
      .expect(201);
    const rejected = await http()
      .post(`/orders/${third.body.id}/reject`)
      .set(bearer(cashier))
      .send({ reason: 'Plus de thé' })
      .expect(200);
    expect(rejected.body).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'Plus de thé',
    });
  });

  it('adds a counter order, bills the table with a discount and prints the receipt', async () => {
    const counter = await http()
      .post('/orders/counter')
      .set(bearer(cashier))
      .send({ tableId, items: [{ dishId: dishes[1].id, quantity: 2 }] })
      .expect(201);
    expect(counter.body).toMatchObject({
      status: 'ACCEPTED',
      source: 'COUNTER',
      createdBy: 'Sami',
    });

    const tabs = await http()
      .get('/orders/tabs')
      .set(bearer(cashier))
      .expect(200);
    const tab = tabs.body.find(
      (t: { table: { id: string } | null }) => t.table?.id === tableId,
    );
    expect(tab.orders).toHaveLength(2);
    expect(tab.totalMillimes).toBe(9500 + 4000);

    const receipt = await http()
      .post('/orders/pay')
      .set(bearer(cashier))
      .send({
        orderIds: tab.orders.map((o: { id: string }) => o.id),
        method: 'CASH',
        discountMillimes: 500,
      })
      .expect(201);
    expect(receipt.body).toMatchObject({
      number: 1,
      table: 'T1',
      method: 'CASH',
      cashierName: 'Sami',
      subtotal: 13.5,
      discount: 0.5,
      total: 13,
      restaurant: { name: 'Café test', taxId: '1234567/A/M/000' },
    });
    expect(receipt.body.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Café direct', quantity: 2, total: 5 }),
        expect.objectContaining({ name: 'Thé', quantity: 2, total: 4 }),
      ]),
    );
    // A paid order cannot be paid twice.
    await http()
      .post('/orders/pay')
      .set(bearer(cashier))
      .send({ orderIds: [orderId], method: 'CARD' })
      .expect(409);
    const after = await http()
      .get('/orders/tabs')
      .set(bearer(cashier))
      .expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('closes the day with totals by payment method', async () => {
    const report = await http()
      .get('/orders/report/day')
      .set(bearer(cashier))
      .expect(200);
    expect(report.body).toMatchObject({
      bills: 1,
      total: 13,
      cash: 13,
      card: 0,
      discounts: 0.5,
      orders: { SERVED: 2, REJECTED: 1, CANCELLED: 1 },
      unpaid: { orders: 0, total: 0 },
    });
    expect(report.body.topItems[0]).toMatchObject({
      name: 'Café direct',
      quantity: 2,
    });
    await http().get('/orders/report/day').set(bearer(waiter)).expect(403);
  });
});
