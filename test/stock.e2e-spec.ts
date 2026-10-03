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

// Stock, expiry, waste and promo prices (S-01…S-04).
describe('Stock and anti-waste (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emails: string[] = [];
  const owner = { token: '', slug: '', userId: '' };
  const other = { token: '', slug: '', userId: '' };
  let brik = '';
  let coffee = '';
  let tableToken = '';
  let cashier = '';
  let manager = '';
  const session = `s-${randomUUID()}`;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function makeOwner(target: typeof owner) {
    const email = `stk-${randomUUID()}@example.com`;
    emails.push(email);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'not-used',
        fullName: 'Owner',
        emailVerifiedAt: new Date(),
      },
    });
    target.userId = user.id;
    target.token = await app
      .get(JwtService)
      .signAsync({ sub: user.id, ver: 0 });
    target.slug = `stk-${randomUUID().slice(0, 8)}`;
    await http()
      .post('/restaurant')
      .set(bearer(target.token))
      .send({ name: 'Café stock', slug: target.slug })
      .expect(201);
  }

  // Loose rows: the assertions name the fields they care about.
  interface Row {
    id: string;
    stockQty: number | null;
    batches: { remaining: number }[];
    nextExpiry: string | null;
    soldOut: boolean;
    promoPrice: number | null;
  }
  const stockOf = async (dishId: string): Promise<Row> => {
    const res = await http().get('/stock').set(bearer(owner.token)).expect(200);
    return (res.body.dishes as Row[]).find((d) => d.id === dishId)!;
  };
  const guestOrder = (dishId: string, quantity: number) =>
    http()
      .post(`/public/menu/${owner.slug}/orders`)
      .send({ sessionId: session, tableToken, items: [{ dishId, quantity }] });
  const publicDish = async (dishId: string): Promise<Row> => {
    const menu = await http().get(`/public/menu/${owner.slug}`).expect(200);
    return (menu.body.categories[0].dishes as Row[]).find(
      (d) => d.id === dishId,
    )!;
  };

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
      .send({ name: 'Carte' })
      .expect(201);
    const add = async (name: string, price: number) =>
      (
        await http()
          .post('/dishes')
          .set(bearer(owner.token))
          .send({ categoryId: category.body.id, name, price })
          .expect(201)
      ).body.id as string;
    brik = await add('Brik', 4.5);
    coffee = await add('Café', 2.8);
    await http()
      .post('/tables/bulk')
      .set(bearer(owner.token))
      .send({ count: 1 })
      .expect(201);
    tableToken = (await http().get('/tables').set(bearer(owner.token))).body[0]
      .token;
    await http()
      .patch('/restaurant')
      .set(bearer(owner.token))
      .send({ orderingEnabled: true })
      .expect(200);
    for (const [name, role, pin] of [
      ['Sami', 'CASHIER', '1234'],
      ['Mona', 'MANAGER', '4321'],
    ]) {
      await http()
        .post('/staff')
        .set(bearer(owner.token))
        .send({ name, role, pin })
        .expect(201);
    }
    const login = async (pin: string) =>
      (
        await http()
          .post('/staff-auth/login')
          .send({ restaurant: owner.slug, pin })
          .expect(200)
      ).body.token as string;
    cashier = await login('1234');
    manager = await login('4321');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('starts tracking a dish when stock is added, for the owner and managers only', async () => {
    const before = await stockOf(brik);
    expect(before).toMatchObject({ tracked: false, stockQty: null });
    await http()
      .post(`/stock/dishes/${brik}/restock`)
      .set(bearer(cashier))
      .send({ quantity: 5 })
      .expect(403);
    await http()
      .post(`/stock/dishes/${brik}/restock`)
      .set(bearer(other.token))
      .send({ quantity: 5 })
      .expect(404);
    await http()
      .post(`/stock/dishes/${brik}/restock`)
      .set(bearer(manager))
      .send({ quantity: 5, expiresOn: 'today' })
      .expect(200);
    const after = await stockOf(brik);
    expect(after).toMatchObject({ tracked: true, stockQty: 5 });
    expect(after.batches).toHaveLength(1);
    expect(after.nextExpiry).not.toBeNull();
    expect(await publicDish(brik)).toMatchObject({
      soldOut: false,
      trackStock: true,
      stockQty: 5,
    });
    // Dishes that are not tracked are never limited.
    expect(await publicDish(coffee)).toMatchObject({
      trackStock: false,
      stockQty: null,
    });
  });

  it('holds stock for an order and gives it back when refused or cancelled', async () => {
    const first = await guestOrder(brik, 2).expect(201);
    expect((await stockOf(brik)).stockQty).toBe(3);
    const tooMany = await guestOrder(brik, 4).expect(409);
    expect(tooMany.body.message).toBe('Il ne reste que 3 × Brik');

    await http()
      .post(`/orders/${first.body.id}/reject`)
      .set(bearer(cashier))
      .send({ reason: 'Plat épuisé' })
      .expect(200);
    expect((await stockOf(brik)).stockQty).toBe(5);

    const second = await guestOrder(brik, 1).expect(201);
    await http()
      .post(
        `/public/menu/${owner.slug}/orders/${second.body.id}/cancel?sessionId=${session}`,
      )
      .expect(200);
    const dish = await stockOf(brik);
    expect(dish.stockQty).toBe(5);
    // The batch itself is whole again, not only the total.
    expect(dish.batches[0].remaining).toBe(5);

    const sold = await guestOrder(brik, 2).expect(201);
    await http()
      .post(`/orders/${sold.body.id}/accept`)
      .set(bearer(cashier))
      .expect(200);
    expect(await stockOf(brik)).toMatchObject({ stockQty: 3, soldToday: 2 });
  });

  it('corrects the stock after a count, records waste, and sells out at 0', async () => {
    await http()
      .post(`/stock/dishes/${brik}/count`)
      .set(bearer(owner.token))
      .send({ quantity: 2 })
      .expect(200);
    expect((await stockOf(brik)).stockQty).toBe(2);
    await http()
      .post(`/stock/dishes/${brik}/waste`)
      .set(bearer(owner.token))
      .send({ quantity: 5, reason: 'Tombé' })
      .expect(409);
    await http()
      .post(`/stock/dishes/${brik}/waste`)
      .set(bearer(owner.token))
      .send({ quantity: 2, reason: 'Tombé' })
      .expect(200);
    expect((await stockOf(brik)).stockQty).toBe(0);
    expect((await publicDish(brik)).soldOut).toBe(true);
    const refused = await guestOrder(brik, 1).expect(409);
    expect(refused.body.message).toBe('« Brik » est épuisé');

    const history = await http()
      .get(`/stock/movements?dishId=${brik}`)
      .set(bearer(owner.token))
      .expect(200);
    expect(
      history.body.map((m: { type: string; quantity: number }) => [
        m.type,
        m.quantity,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['RESTOCK', 5],
        ['SALE', -2],
        ['RETURN', 2],
        ['ADJUST', -1],
        ['WASTE', -2],
      ]),
    );
    // The ledger and the stock agree.
    const ledger = await prisma.stockMovement.aggregate({
      where: { dishId: brik },
      _sum: { quantity: true },
    });
    expect(ledger._sum.quantity).toBe(0);
  });

  it('removes expired stock as waste and counts its value', async () => {
    await http()
      .post(`/stock/dishes/${coffee}/restock`)
      .set(bearer(owner.token))
      .send({ quantity: 4, expiresOn: 'today' })
      .expect(200);
    await http()
      .post(`/stock/dishes/${coffee}/restock`)
      .set(bearer(owner.token))
      .send({ quantity: 6 })
      .expect(200);
    // The first batch's date passes.
    await prisma.stockBatch.updateMany({
      where: { dishId: coffee, quantity: 4 },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const overview = await http()
      .get('/stock')
      .set(bearer(owner.token))
      .expect(200);
    const dish = overview.body.dishes.find(
      (d: { id: string }) => d.id === coffee,
    );
    expect(dish.stockQty).toBe(6);
    // 2 briks (4.5) + 4 coffees (2.8) thrown away.
    expect(overview.body.waste30).toEqual({ quantity: 6, value: 20.2 });
    await http()
      .post(`/stock/dishes/${coffee}/restock`)
      .set(bearer(owner.token))
      .send({ quantity: 1, expiresOn: '2020-01-01' })
      .expect(400);
  });

  it('suggests a promo for stock about to expire and applies it to orders', async () => {
    await http()
      .post(`/stock/dishes/${brik}/restock`)
      .set(bearer(owner.token))
      .send({ quantity: 10, expiresOn: 'today' })
      .expect(200);
    const overview = await http()
      .get('/stock')
      .set(bearer(owner.token))
      .expect(200);
    const suggestion = overview.body.suggestions.find(
      (s: { dishId: string; kind: string }) =>
        s.dishId === brik && s.kind === 'promo',
    );
    expect(suggestion.title).toBe('10 × Brik à vendre avant ce soir');
    expect(suggestion.action.type).toBe('promo');

    const applied = await http()
      .post(`/stock/dishes/${brik}/promo`)
      .set(bearer(owner.token))
      .send({ percent: 20, until: suggestion.action.until })
      .expect(200);
    expect(applied.body.price).toBe(3.6);
    expect(await publicDish(brik)).toMatchObject({
      price: 4.5,
      promoPrice: 3.6,
      promoPercent: 20,
    });
    const order = await guestOrder(brik, 2).expect(201);
    expect(order.body.totalMillimes).toBe(7200);
    // A running promo is not suggested again.
    const again = await http()
      .get('/stock')
      .set(bearer(owner.token))
      .expect(200);
    expect(
      again.body.suggestions.filter(
        (s: { dishId: string }) => s.dishId === brik,
      ),
    ).toHaveLength(0);

    await http()
      .delete(`/stock/dishes/${brik}/promo`)
      .set(bearer(owner.token))
      .expect(204);
    expect((await publicDish(brik)).promoPrice).toBeNull();
    await http()
      .post(`/stock/dishes/${brik}/promo`)
      .set(bearer(owner.token))
      .send({ percent: 2, until: 'today' })
      .expect(400);
  });

  it('belongs to Business: without it, tracking no longer limits the menu', async () => {
    await http()
      .post(`/stock/dishes/${brik}/count`)
      .set(bearer(owner.token))
      .send({ quantity: 0 })
      .expect(200);
    expect((await publicDish(brik)).soldOut).toBe(true);
    await prisma.subscription.update({
      where: { userId: owner.userId },
      data: {
        status: 'active',
        plan: 'premium',
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      },
    });
    const refused = await http()
      .get('/stock')
      .set(bearer(owner.token))
      .expect(403);
    expect(refused.body).toMatchObject({
      code: 'PLAN_REQUIRED',
      requiredPlan: 'business',
    });
    expect(await publicDish(brik)).toMatchObject({
      soldOut: false,
      trackStock: false,
    });
    await guestOrder(brik, 1).expect(201);
  });
});
