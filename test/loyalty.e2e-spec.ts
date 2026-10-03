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

// Loyalty stamp cards (L-01…L-03): program, guest card, stamp at payment, reward.
describe('Loyalty (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emails: string[] = [];
  const owner = { token: '', slug: '', userId: '' };
  const other = { token: '', slug: '', userId: '' };
  let cashier = '';
  let waiter = '';
  let dishId = '';
  let code = '';
  let cardId = '';

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function makeOwner(target: typeof owner) {
    const email = `loy-${randomUUID()}@example.com`;
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
    target.slug = `loy-${randomUUID().slice(0, 8)}`;
    await http()
      .post('/restaurant')
      .set(bearer(target.token))
      .send({ name: 'Café fidèle', slug: target.slug })
      .expect(201);
  }

  /** A counter sale paid in cash, with or without a loyalty card. */
  async function sale(quantity: number, loyaltyCardId?: string) {
    const order = await http()
      .post('/orders/counter')
      .set(bearer(cashier))
      .send({ items: [{ dishId, quantity }] })
      .expect(201);
    return http()
      .post('/orders/pay')
      .set(bearer(cashier))
      .send({ orderIds: [order.body.id], method: 'CASH', loyaltyCardId })
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
    dishId = (
      await http()
        .post('/dishes')
        .set(bearer(owner.token))
        .send({ categoryId: category.body.id, name: 'Café', price: 2.5 })
        .expect(201)
    ).body.id;
    for (const [name, role, pin] of [
      ['Sami', 'CASHIER', '1234'],
      ['Nour', 'WAITER', '5678'],
    ]) {
      await http()
        .post('/staff')
        .set(bearer(owner.token))
        .send({ name, role, pin })
        .expect(201);
    }
    const login = (pin: string) =>
      http()
        .post('/staff-auth/login')
        .send({ restaurant: owner.slug, pin })
        .expect(200);
    cashier = (await login('1234')).body.token;
    waiter = (await login('5678')).body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('starts off, then the owner sets the program and the card design', async () => {
    const initial = await http()
      .get('/loyalty/program')
      .set(bearer(owner.token))
      .expect(200);
    expect(initial.body).toMatchObject({
      enabled: false,
      stampsRequired: 9,
      googleWallet: false,
    });
    const menu = await http().get(`/public/menu/${owner.slug}`).expect(200);
    expect(menu.body.loyalty).toBeNull();
    await http()
      .post(`/public/loyalty/${owner.slug}/join`)
      .send({ name: 'Amine', phone: '20 123 456', consent: true })
      .expect(404);

    await http()
      .patch('/loyalty/program')
      .set(bearer(owner.token))
      .send({ stampsRequired: 2 })
      .expect(400);
    await http()
      .patch('/loyalty/program')
      .set(bearer(owner.token))
      .send({ backgroundColor: 'red' })
      .expect(400);
    const saved = await http()
      .patch('/loyalty/program')
      .set(bearer(owner.token))
      .send({
        enabled: true,
        stampsRequired: 3,
        rewardText: '1 café offert',
        cardTitle: 'Club Café',
        backgroundColor: '#0f766e',
        stampIcon: 'star',
      })
      .expect(200);
    expect(saved.body).toMatchObject({ enabled: true, stampsRequired: 3 });
    // Staff do not edit the program.
    await http()
      .patch('/loyalty/program')
      .set(bearer(cashier))
      .send({ stampsRequired: 5 })
      .expect(403);

    const after = await http().get(`/public/menu/${owner.slug}`).expect(200);
    expect(after.body.loyalty).toEqual({
      stampsRequired: 3,
      rewardText: '1 café offert',
      cardTitle: 'Club Café',
      backgroundColor: '#0f766e',
      stampIcon: 'star',
    });
  });

  it('gives a guest a card, once per phone number, without exposing the number', async () => {
    await http()
      .post(`/public/loyalty/${owner.slug}/join`)
      .send({ name: 'Amine', phone: '20 123 456', consent: false })
      .expect(400);
    await http()
      .post(`/public/loyalty/${owner.slug}/join`)
      .send({ name: 'Amine', phone: '12', consent: true })
      .expect(400);
    const joined = await http()
      .post(`/public/loyalty/${owner.slug}/join`)
      .send({ name: 'Amine', phone: '+216 20 123 456', consent: true })
      .expect(201);
    code = joined.body.code;
    expect(code).toMatch(/^[A-Za-z0-9_-]{12}$/);
    // Same number written differently: the existing card is not handed over.
    const again = await http()
      .post(`/public/loyalty/${owner.slug}/join`)
      .send({ name: 'Quelqu’un', phone: '20123456', consent: true })
      .expect(409);
    expect(JSON.stringify(again.body)).not.toContain(code);

    const card = await http().get(`/public/loyalty/cards/${code}`).expect(200);
    expect(card.body).toMatchObject({
      name: 'Amine',
      stamps: 0,
      stampsRequired: 3,
      rewardsAvailable: 0,
      googleWalletUrl: null,
      program: { active: true, backgroundColor: '#0f766e', stampIcon: 'star' },
      restaurant: { slug: owner.slug },
    });
    expect(JSON.stringify(card.body)).not.toContain('20123456');
    await http().get('/public/loyalty/cards/unknown-code-1').expect(404);
  });

  it('lets the cashier find the card by name, phone, code or scanned address', async () => {
    for (const search of [
      'ami',
      '123 456',
      code,
      `https://menu.example/c/${code}`,
    ]) {
      const found = await http()
        .get(`/loyalty/cards?search=${encodeURIComponent(search)}`)
        .set(bearer(cashier))
        .expect(200);
      expect(found.body).toHaveLength(1);
      cardId = found.body[0].id;
      // Cashiers see the end of the number only.
      expect(found.body[0].phone).toBe('•••••456');
    }
    const full = await http()
      .get('/loyalty/cards')
      .set(bearer(owner.token))
      .expect(200);
    expect(full.body[0].phone).toBe('20123456');
    await http().get('/loyalty/cards').set(bearer(waiter)).expect(403);
    // Another restaurant sees nothing and cannot stamp it.
    const elsewhere = await http()
      .get(`/loyalty/cards?search=${code}`)
      .set(bearer(other.token))
      .expect(200);
    expect(elsewhere.body).toHaveLength(0);
    await http()
      .post(`/loyalty/cards/${cardId}/stamp`)
      .set(bearer(other.token))
      .expect(404);
  });

  it('stamps the card at payment, once per ticket, and prints it on the receipt', async () => {
    const receipt = await sale(1, cardId);
    expect(receipt.body.loyalty).toEqual({
      name: 'Amine',
      stamps: 1,
      stampsRequired: 3,
      rewardsAvailable: 0,
      rewardText: '1 café offert',
    });
    const plain = await sale(1);
    expect(plain.body.loyalty).toBeNull();
    // Right after a stamp, a cashier cannot add another one by hand.
    await http()
      .post(`/loyalty/cards/${cardId}/stamp`)
      .set(bearer(cashier))
      .expect(409);
    // The owner can (a forgotten stamp).
    const manual = await http()
      .post(`/loyalty/cards/${cardId}/stamp`)
      .set(bearer(owner.token))
      .expect(200);
    expect(manual.body).toMatchObject({ stamps: 2, rewardsAvailable: 0 });
  });

  it('skips the stamp under the minimum spend, then gives the reward once', async () => {
    await http()
      .patch('/loyalty/program')
      .set(bearer(owner.token))
      .send({ minSpend: 5 })
      .expect(200);
    const small = await sale(1, cardId); // 2.5 DT
    expect(small.body.loyalty).toBeNull();
    const big = await sale(2, cardId); // 5 DT
    expect(big.body.loyalty).toMatchObject({ stamps: 0, rewardsAvailable: 1 });

    const guest = await http().get(`/public/loyalty/cards/${code}`).expect(200);
    expect(guest.body).toMatchObject({ stamps: 0, rewardsAvailable: 1 });

    const redeemed = await http()
      .post(`/loyalty/cards/${cardId}/redeem`)
      .set(bearer(cashier))
      .expect(200);
    expect(redeemed.body).toMatchObject({
      stamps: 0,
      rewardsAvailable: 0,
      rewardsRedeemed: 1,
    });
    await http()
      .post(`/loyalty/cards/${cardId}/redeem`)
      .set(bearer(cashier))
      .expect(409);

    const stats = await http()
      .get('/loyalty/stats')
      .set(bearer(owner.token))
      .expect(200);
    expect(stats.body).toEqual({
      members: 1,
      newMembers: 1,
      activeMembers: 1,
      stamps: 3,
      rewards: 1,
    });
  });

  it('opens a card at the counter and lets the guest delete theirs', async () => {
    const created = await http()
      .post('/loyalty/cards')
      .set(bearer(cashier))
      .send({ name: 'Leila', phone: '98 765 432' })
      .expect(201);
    expect(created.body.cardUrl).toContain(`/c/${created.body.code}`);
    await http()
      .post('/loyalty/cards')
      .set(bearer(cashier))
      .send({ name: 'Leila', phone: '98765432' })
      .expect(409);

    await http().delete(`/public/loyalty/cards/${code}`).expect(204);
    await http().get(`/public/loyalty/cards/${code}`).expect(404);
    expect(await prisma.loyaltyEvent.count({ where: { cardId } })).toBe(0);
  });

  it('belongs to Premium: closed on Standard', async () => {
    await prisma.subscription.update({
      where: { userId: owner.userId },
      data: {
        status: 'active',
        plan: 'standard',
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      },
    });
    const refused = await http()
      .patch('/loyalty/program')
      .set(bearer(owner.token))
      .send({ rewardText: 'Un dessert offert' })
      .expect(403);
    expect(refused.body).toMatchObject({
      code: 'PLAN_REQUIRED',
      requiredPlan: 'premium',
    });
    const menu = await http().get(`/public/menu/${owner.slug}`).expect(200);
    expect(menu.body.loyalty).toBeNull();
    await http()
      .post(`/public/loyalty/${owner.slug}/join`)
      .send({ name: 'Sara', phone: '55 111 222', consent: true })
      .expect(404);
  });
});
