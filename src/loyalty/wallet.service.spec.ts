import { ConfigService } from '@nestjs/config';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { normalizePhone } from './loyalty.service';
import {
  GoogleWalletService,
  stampBalance,
  type WalletFetch,
} from './wallet.service';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const account = Buffer.from(
  JSON.stringify({
    client_email: 'wallet@project.iam.gserviceaccount.com',
    private_key: privateKey,
  }),
).toString('base64');

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const card = { code: 'Abc123_-xyz9', name: 'Amine', stamps: 11 };
const program = {
  restaurantId: '3ea09ac6-2255-4dec-92c6-7ca3c84a0379',
  restaurantName: 'Café Tunis Centre',
  logoUrl: null,
  cardTitle: null,
  backgroundColor: '#7c2d12',
  stampsRequired: 9,
  rewardText: '1 café offert',
  cardUrl: 'https://menu.example/c/Abc123_-xyz9',
};

function setup(values: Record<string, string>) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const status = { patch: 200, classInsert: 200 };
  const fetcher: WalletFetch = (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    if (url.includes('oauth2')) {
      return Promise.resolve({
        status: 200,
        json: () =>
          Promise.resolve({ access_token: 'token-1', expires_in: 3600 }),
      });
    }
    return Promise.resolve({
      status:
        init.method === 'POST' && url.endsWith('/loyaltyClass')
          ? status.classInsert
          : status.patch,
      json: () => Promise.resolve({}),
    });
  };
  return {
    service: new GoogleWalletService(config(values), fetcher),
    calls,
    status,
  };
}

const configured = {
  GOOGLE_WALLET_ISSUER_ID: '3388000000012345678',
  GOOGLE_WALLET_SERVICE_ACCOUNT: account,
  FRONTEND_URL: 'https://menu.example',
};

describe('GoogleWalletService', () => {
  it('stays off without an issuer and a service account', async () => {
    const { service, calls } = setup({ FRONTEND_URL: 'https://menu.example' });
    expect(service.configured).toBe(false);
    expect(await service.saveUrl(card, program)).toBeNull();
    await service.sync(card, program);
    expect(calls).toHaveLength(0);
  });

  const decode = (url: string) => {
    const [header, body, signature] = url.split('/save/')[1].split('.');
    expect(
      createVerify('RSA-SHA256')
        .update(`${header}.${body}`)
        .verify(publicKey, Buffer.from(signature, 'base64url')),
    ).toBe(true);
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      iss: string;
      aud: string;
      typ: string;
      origins: string[];
      payload: {
        loyaltyClasses?: Record<string, unknown>[];
        loyaltyObjects: Record<string, unknown>[];
      };
    };
  };

  it('registers the design once and signs a short "Add to Google Wallet" link', async () => {
    const { service, calls } = setup(configured);
    const url = (await service.saveUrl(card, program))!;
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    // Google's documented safe length for the token is 1800 characters.
    expect(url.split('/save/')[1].length).toBeLessThan(1800);

    const claims = decode(url);
    expect(claims).toMatchObject({
      iss: 'wallet@project.iam.gserviceaccount.com',
      aud: 'google',
      typ: 'savetowallet',
      origins: ['https://menu.example'],
    });
    expect(claims.payload.loyaltyClasses).toBeUndefined();
    expect(claims.payload.loyaltyObjects[0]).toMatchObject({
      id: '3388000000012345678.Abc123_-xyz9',
      classId: '3388000000012345678.tableqr_3ea09ac622554dec92c67ca3c84a0379',
      state: 'ACTIVE',
      accountName: 'Amine',
      barcode: { type: 'QR_CODE', value: 'Abc123_-xyz9' },
      loyaltyPoints: {
        label: 'Tampons',
        balance: { string: '2 / 9 · 1 offert' },
      },
    });

    // The design went to Google once; a second card reuses it.
    expect(calls.map((c) => c.method)).toEqual(['POST', 'POST']);
    expect(calls[1].url).toBe(
      'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass',
    );
    expect(JSON.parse(calls[1].body!)).toMatchObject({
      id: '3388000000012345678.tableqr_3ea09ac622554dec92c67ca3c84a0379',
      issuerName: 'Café Tunis Centre',
      programName: 'Carte de fidélité',
      hexBackgroundColor: '#7c2d12',
      reviewStatus: 'UNDER_REVIEW',
      programLogo: {
        sourceUri: { uri: 'https://menu.example/icons/icon-512.png' },
      },
    });
    await service.saveUrl({ ...card, code: 'Other_card_01' }, program);
    expect(calls).toHaveLength(2);
  });

  it('updates an existing design, and falls back when Google is down', async () => {
    const existing = setup(configured);
    existing.status.classInsert = 409;
    await existing.service.saveUrl(card, program);
    expect(existing.calls.map((c) => c.method)).toEqual([
      'POST',
      'POST',
      'PATCH',
    ]);
    expect(existing.calls[2].url).toContain(
      '/loyaltyClass/3388000000012345678.tableqr_',
    );

    const down = setup(configured);
    down.status.classInsert = 503;
    const claims = decode((await down.service.saveUrl(card, program))!);
    expect(claims.payload.loyaltyClasses).toHaveLength(1);
  });

  it('updates a saved pass with one token for several updates', async () => {
    const { service, calls, status } = setup(configured);
    await service.sync(card, program);
    status.patch = 404; // a card never added to Google Wallet
    await service.sync({ ...card, stamps: 12 }, program);
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH', 'PATCH']);
    expect(calls[1].url).toBe(
      'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/3388000000012345678.Abc123_-xyz9',
    );
    expect(JSON.parse(calls[2].body!)).toMatchObject({
      loyaltyPoints: { balance: { string: '3 / 9 · 1 offert' } },
    });
  });
});

describe('GoogleWalletService.testPass (Console → Système)', () => {
  it('explains what is missing when Wallet is not set up', async () => {
    const { service, calls } = setup({ FRONTEND_URL: 'https://menu.example' });
    const result = await service.testPass();
    expect(result).toMatchObject({ ok: false, saveUrl: null });
    expect(result.detail).toContain('GOOGLE_WALLET_ISSUER_ID');
    expect(calls).toHaveLength(0);
  });

  it('signs in, registers a sample design and returns a pass to save', async () => {
    const { service, calls } = setup(configured);
    const result = await service.testPass();
    expect(result.ok).toBe(true);
    expect(result.saveUrl).toMatch(
      /^https:\/\/pay\.google\.com\/gp\/v\/save\//,
    );
    expect(calls.map((c) => c.method)).toEqual(['POST', 'POST']);
  });

  it("returns Google's reason when the design is refused", async () => {
    const fetcher: WalletFetch = (url) =>
      Promise.resolve(
        url.includes('oauth2')
          ? { status: 200, json: () => Promise.resolve({ access_token: 't' }) }
          : {
              status: 403,
              json: () =>
                Promise.resolve({
                  error: { message: 'The caller does not have permission' },
                }),
            },
      );
    const service = new GoogleWalletService(config(configured), fetcher);
    const result = await service.testPass();
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('403 The caller does not have permission');
  });

  it('reports a key Google refuses', async () => {
    const fetcher: WalletFetch = () =>
      Promise.resolve({ status: 400, json: () => Promise.resolve({}) });
    const service = new GoogleWalletService(config(configured), fetcher);
    const result = await service.testPass();
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('clé du compte de service');
  });
});

describe('helpers', () => {
  it('shows progress and rewards waiting', () => {
    expect(stampBalance(4, 9)).toBe('4 / 9');
    expect(stampBalance(9, 9)).toBe('0 / 9 · 1 offert');
    expect(stampBalance(20, 9)).toBe('2 / 9 · 2 offerts');
  });

  it.each([
    ['20 123 456', '20123456'],
    ['+216 20 123 456', '20123456'],
    ['0021620123456', '20123456'],
    ['+33 6 12 34 56 78', '33612345678'],
  ])('normalises the phone %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['123', 'abc', '1234567890123456'])(
    'refuses the phone %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});
