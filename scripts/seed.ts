/**
 * npm run seed
 *
 * Demo data for a LOCAL database (P0-02): "Café Tunis Centre" (French and
 * Arabic, 12 tables), "Restaurant Hammamet Plage" (5 languages, 30 tables) and
 * "Hôtel Djerba" (2 outlets, one account each until multi-branch, P6-03), with
 * some guest activity so the dashboards are not empty.
 *
 * Safe to run again: it replaces only the accounts it created itself
 * (emails ending in @seed.tableqr.test). It refuses any database that is not
 * on this machine, and any server mode.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { loadEnv } from './load-env';

const DOMAIN = '@seed.tableqr.test';
const PASSWORD = 'Demo-pass-123';
const DAY = 86_400_000;

const { env } = loadEnv();
const databaseUrl = env.DATABASE_URL ?? '';
const host = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(
    `Refused: the seed only runs on a local database (host is "${host || 'unknown'}").`,
  );
  process.exit(1);
}
if (['prelaunch', 'production'].includes(env.APP_ENV ?? '')) {
  console.error(`Refused: APP_ENV is ${env.APP_ENV}.`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

type Text = { fr: string; ar?: string; en?: string; de?: string; it?: string };
type DishSeed = { name: Text; desc?: Text; price: number; img?: string };
type CategorySeed = { name: Text; dishes: DishSeed[] };

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;

const cafeMenu: CategorySeed[] = [
  {
    name: { fr: 'Petit-déjeuner', ar: 'فطور الصباح' },
    dishes: [
      { name: { fr: 'Café direct', ar: 'قهوة ديراكت' }, price: 2.5 },
      { name: { fr: 'Capucin', ar: 'كابوسان' }, price: 2.8 },
      {
        name: { fr: 'Bambalouni', ar: 'بمبالوني' },
        desc: {
          fr: 'Beignet de Sidi Bou Saïd au sucre',
          ar: 'فطيرة سيدي بوسعيد بالسكر',
        },
        price: 1.5,
      },
      {
        name: { fr: 'Ftour tunisien', ar: 'فطور تونسي' },
        desc: {
          fr: 'Œuf, fromage, olives, harissa, pain tabouna',
          ar: 'عظم، جبن، زيتون، هريسة، خبز طابونة',
        },
        price: 9,
        img: img('1533089860892-a7c6f0a88666'),
      },
    ],
  },
  {
    name: { fr: 'Plats', ar: 'أطباق' },
    dishes: [
      {
        name: { fr: "Brik à l'œuf", ar: 'بريك بالعظم' },
        desc: {
          fr: 'Feuille de malsouka, œuf, thon, persil',
          ar: 'ورقة ملسوقة، عظم، تن، معدنوس',
        },
        price: 4.5,
      },
      {
        name: { fr: 'Ojja merguez', ar: 'عجة مرقاز' },
        desc: {
          fr: 'Œufs, tomate, poivron, harissa',
          ar: 'عظم، طماطم، فلفل، هريسة',
        },
        price: 14,
        img: img('1590412200988-a436970781fa'),
      },
      {
        name: { fr: 'Lablabi', ar: 'لبلابي' },
        desc: {
          fr: 'Pois chiches, cumin, œuf, pain',
          ar: 'حمص، كمون، عظم، خبز',
        },
        price: 6,
      },
      {
        name: { fr: 'Couscous au poisson', ar: 'كسكسي بالحوت' },
        price: 22,
        img: img('1541518763669-27fef04b14ea'),
      },
    ],
  },
  {
    name: { fr: 'Boissons', ar: 'مشروبات' },
    dishes: [
      { name: { fr: 'Thé à la menthe', ar: 'تاي بالنعناع' }, price: 2 },
      { name: { fr: 'Thé aux pignons', ar: 'تاي بالبوفريوة' }, price: 5 },
      { name: { fr: 'Citronnade', ar: 'سيتروناد' }, price: 4 },
      { name: { fr: 'Eau minérale 1 L', ar: 'ماء معدني 1 ل' }, price: 1.8 },
    ],
  },
];

const t5 = (
  fr: string,
  ar: string,
  en: string,
  de: string,
  it: string,
): Text => ({ fr, ar, en, de, it });

const hammametMenu: CategorySeed[] = [
  {
    name: t5('Entrées', 'مقبلات', 'Starters', 'Vorspeisen', 'Antipasti'),
    dishes: [
      {
        name: t5(
          'Salade méchouia',
          'سلطة مشوية',
          'Grilled pepper salad (méchouia)',
          'Gegrillter Paprikasalat (Méchouia)',
          'Insalata di peperoni grigliati (méchouia)',
        ),
        price: 9,
      },
      {
        name: t5(
          "Brik à l'œuf",
          'بريك بالعظم',
          'Brik (crispy pastry with egg)',
          'Brik (knuspriges Teigblatt mit Ei)',
          'Brik (sfoglia croccante con uovo)',
        ),
        price: 6,
      },
      {
        name: t5(
          'Chorba frik',
          'شربة فريك',
          'Chorba (cracked wheat soup)',
          'Chorba (Weizensuppe)',
          'Chorba (zuppa di grano)',
        ),
        price: 8,
      },
    ],
  },
  {
    name: t5('Poissons', 'أسماك', 'Fish', 'Fisch', 'Pesce'),
    dishes: [
      {
        name: t5(
          'Dorade grillée',
          'وراطة مشوية',
          'Grilled sea bream',
          'Gegrillte Dorade',
          'Orata alla griglia',
        ),
        price: 42,
        img: img('1519708227418-c8fd9a32b7a2'),
      },
      {
        name: t5('Loup de mer', 'قاروص', 'Sea bass', 'Wolfsbarsch', 'Branzino'),
        price: 48,
      },
      {
        name: t5(
          'Couscous au mérou',
          'كسكسي بالمناني',
          'Couscous with grouper',
          'Couscous mit Zackenbarsch',
          'Cuscus con cernia',
        ),
        price: 38,
        img: img('1541518763669-27fef04b14ea'),
      },
      {
        name: t5(
          'Calamars frits',
          'قلمار مقلي',
          'Fried squid',
          'Frittierte Calamari',
          'Calamari fritti',
        ),
        price: 28,
      },
    ],
  },
  {
    name: t5('Desserts', 'حلويات', 'Desserts', 'Desserts', 'Dolci'),
    dishes: [
      {
        name: t5(
          'Assida zgougou',
          'عصيدة زقوقو',
          'Assida (pine-nut cream)',
          'Assida (Pinienkern-Creme)',
          'Assida (crema di pinoli)',
        ),
        price: 10,
      },
      {
        name: t5(
          'Salade de fruits',
          'سلطة غلال',
          'Fruit salad',
          'Obstsalat',
          'Macedonia',
        ),
        price: 9,
      },
    ],
  },
];

const djerbaRestaurantMenu: CategorySeed[] = [
  {
    name: { fr: 'Buffet du soir', ar: 'بوفيه العشاء', en: 'Dinner buffet' },
    dishes: [
      {
        name: { fr: 'Buffet adulte', ar: 'بوفيه كبار', en: 'Adult buffet' },
        price: 65,
      },
      {
        name: { fr: 'Buffet enfant', ar: 'بوفيه أطفال', en: 'Children buffet' },
        price: 30,
      },
    ],
  },
  {
    name: { fr: 'À la carte', ar: 'حسب الطلب', en: 'À la carte' },
    dishes: [
      {
        name: { fr: 'Riz djerbien', ar: 'روز جربي', en: 'Djerba steamed rice' },
        price: 24,
      },
      {
        name: {
          fr: 'Agneau à la gargoulette',
          ar: 'علوش في القلة',
          en: 'Lamb cooked in a clay jar',
        },
        price: 45,
      },
    ],
  },
];

const djerbaBarMenu: CategorySeed[] = [
  {
    name: { fr: 'Boissons fraîches', ar: 'مشروبات باردة', en: 'Cold drinks' },
    dishes: [
      {
        name: {
          fr: 'Jus d’orange pressé',
          ar: 'عصير برتقال',
          en: 'Fresh orange juice',
        },
        price: 8,
      },
      {
        name: {
          fr: 'Mojito sans alcool',
          ar: 'موهيتو بدون كحول',
          en: 'Virgin mojito',
        },
        price: 14,
      },
      {
        name: {
          fr: 'Citronnade à la menthe',
          ar: 'سيتروناد بالنعناع',
          en: 'Mint lemonade',
        },
        price: 9,
      },
    ],
  },
  {
    name: { fr: 'Snacks', ar: 'وجبات خفيفة', en: 'Snacks' },
    dishes: [
      {
        name: { fr: 'Club sandwich', ar: 'كلوب ساندويتش', en: 'Club sandwich' },
        price: 18,
      },
      {
        name: {
          fr: 'Pizza margherita',
          ar: 'بيتزا مارغريتا',
          en: 'Margherita pizza',
        },
        price: 20,
      },
    ],
  },
];

interface LocationSeed {
  key: string;
  owner: string;
  restaurant: string;
  slug: string;
  color: string;
  template: string;
  locales: string[];
  wifi?: { ssid: string; password: string };
  zones: { zone: string; prefix: string; count: number }[];
  menu: CategorySeed[];
  activity: number;
}

const locations: LocationSeed[] = [
  {
    key: 'cafe-tunis',
    owner: 'Amine Ben Ali',
    restaurant: 'Café Tunis Centre',
    slug: 'cafe-tunis-centre',
    color: '#b45309',
    template: 'classic',
    locales: ['fr', 'ar'],
    wifi: { ssid: 'CafeTunis-Clients', password: 'jasmin2026' },
    zones: [
      { zone: 'Salle', prefix: 'T', count: 8 },
      { zone: 'Terrasse', prefix: 'T', count: 4 },
    ],
    menu: cafeMenu,
    activity: 60,
  },
  {
    key: 'hammamet',
    owner: 'Leila Trabelsi',
    restaurant: 'Restaurant Hammamet Plage',
    slug: 'hammamet-plage',
    color: '#0e7490',
    template: 'elegant',
    locales: ['fr', 'ar', 'en', 'de', 'it'],
    wifi: { ssid: 'HammametPlage', password: 'medina-sea' },
    zones: [
      { zone: 'Salle', prefix: 'T', count: 12 },
      { zone: 'Terrasse', prefix: 'T', count: 10 },
      { zone: 'Plage', prefix: 'P', count: 8 },
    ],
    menu: hammametMenu,
    activity: 120,
  },
  {
    key: 'djerba-restaurant',
    owner: 'Hôtel Djerba (restaurant)',
    restaurant: 'Hôtel Djerba · La Palmeraie',
    slug: 'hotel-djerba-palmeraie',
    color: '#15803d',
    template: 'minimal',
    locales: ['fr', 'ar', 'en'],
    zones: [{ zone: 'Restaurant', prefix: 'R', count: 20 }],
    menu: djerbaRestaurantMenu,
    activity: 40,
  },
  {
    key: 'djerba-bar',
    owner: 'Hôtel Djerba (bar)',
    restaurant: 'Hôtel Djerba · Bar de la piscine',
    slug: 'hotel-djerba-bar',
    color: '#1d4ed8',
    template: 'night',
    locales: ['fr', 'ar', 'en'],
    wifi: { ssid: 'HotelDjerba-Guest', password: 'ulysse-1234' },
    zones: [{ zone: 'Piscine', prefix: 'B', count: 10 }],
    menu: djerbaBarMenu,
    activity: 30,
  },
];

function i18n(text: Text): Prisma.InputJsonValue {
  const out: Record<string, string> = {};
  for (const [locale, value] of Object.entries(text))
    if (locale !== 'fr' && value) out[locale] = value;
  return out;
}

/** Deterministic pseudo-random numbers, so every run gives the same data. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

async function main() {
  const removed = await prisma.user.deleteMany({
    where: { email: { endsWith: DOMAIN } },
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = Date.now();

  for (const [index, loc] of locations.entries()) {
    const random = rng(index + 7);
    const user = await prisma.user.create({
      data: {
        email: `${loc.key}${DOMAIN}`,
        fullName: loc.owner,
        passwordHash,
        phone: '+216 20 000 00' + index,
        emailVerifiedAt: new Date(),
        subscription: {
          create: { status: 'trialing', trialEndsAt: new Date(now + 30 * DAY) },
        },
      },
    });
    // Older seed accounts are gone (cascade), so a taken slug belongs to a
    // real local account: leave it alone and say so.
    if (await prisma.restaurant.count({ where: { slug: loc.slug } })) {
      throw new Error(
        `The slug "${loc.slug}" is used by another local account; rename that restaurant first.`,
      );
    }
    const restaurant = await prisma.restaurant.create({
      data: {
        userId: user.id,
        name: loc.restaurant,
        slug: loc.slug,
        primaryColor: loc.color,
        template: loc.template,
        defaultLocale: 'fr',
        enabledLocales: loc.locales,
        wifiSsid: loc.wifi?.ssid,
        wifiPassword: loc.wifi?.password,
      },
    });

    const dishIds: string[] = [];
    for (const [cIndex, category] of loc.menu.entries()) {
      const created = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: category.name.fr,
          nameI18n: i18n(category.name),
          position: cIndex,
        },
      });
      for (const [dIndex, dish] of category.dishes.entries()) {
        const row = await prisma.dish.create({
          data: {
            categoryId: created.id,
            name: dish.name.fr,
            nameI18n: i18n(dish.name),
            description: dish.desc?.fr,
            descriptionI18n: dish.desc ? i18n(dish.desc) : undefined,
            priceMillimes: Math.round(dish.price * 1000),
            imageUrl: dish.img,
            position: dIndex,
          },
        });
        dishIds.push(row.id);
      }
    }

    let position = 0;
    const counters: Record<string, number> = {};
    const tables: { id: string; label: string }[] = [];
    for (const { zone, prefix, count } of loc.zones) {
      for (let i = 0; i < count; i++) {
        counters[prefix] = (counters[prefix] ?? 0) + 1;
        const table = await prisma.diningTable.create({
          data: {
            restaurantId: restaurant.id,
            label: `${prefix}${counters[prefix]}`,
            zone,
            token: randomBytes(16).toString('base64url'),
            position: position++,
          },
        });
        tables.push(table);
      }
    }

    // Two weeks of guest activity, mostly at lunch and dinner (Tunis time).
    const events: Prisma.EventCreateManyInput[] = [];
    const requests: Prisma.ServiceRequestCreateManyInput[] = [];
    for (let v = 0; v < loc.activity; v++) {
      const day = Math.floor(random() * 14);
      const hour =
        random() < 0.5
          ? 12 + Math.floor(random() * 2)
          : 19 + Math.floor(random() * 3);
      const at = new Date(now - day * DAY);
      at.setUTCHours(hour - 1, Math.floor(random() * 60), 0, 0);
      if (at.getTime() > now) at.setTime(at.getTime() - DAY);
      const sessionId = `seed-${loc.key}-${v}`;
      const table = tables[Math.floor(random() * tables.length)];
      const locale = loc.locales[Math.floor(random() * loc.locales.length)];
      events.push({
        restaurantId: restaurant.id,
        type: 'menu_opened',
        sessionId,
        tableId: table.id,
        props: { locale },
        occurredAt: at,
      });
      const views = 1 + Math.floor(random() * 4);
      for (let k = 0; k < views; k++) {
        const itemId = dishIds[Math.floor(random() * dishIds.length)];
        events.push({
          restaurantId: restaurant.id,
          type: 'item_viewed',
          sessionId,
          itemId,
          occurredAt: at,
        });
        if (random() < 0.35)
          events.push({
            restaurantId: restaurant.id,
            type: 'selection_item_added',
            sessionId,
            itemId,
            occurredAt: at,
          });
      }
      if (random() < 0.3) {
        const type =
          random() < 0.6
            ? 'WAITER'
            : random() < 0.5
              ? 'BILL_CASH'
              : 'BILL_CARD';
        const wait = 30 + Math.floor(random() * 240);
        requests.push({
          restaurantId: restaurant.id,
          tableId: table.id,
          sessionId,
          type,
          status: 'DONE',
          createdAt: at,
          acknowledgedAt: new Date(at.getTime() + wait * 1000),
          resolvedAt: new Date(at.getTime() + (wait + 120) * 1000),
        });
      }
    }
    await prisma.event.createMany({ data: events });
    await prisma.serviceRequest.createMany({ data: requests });

    const comments = [
      [5, 'Accueil chaleureux, on reviendra !', ['service']],
      [4, 'Très bon, un peu d’attente.', ['plats', 'attente']],
      [2, 'On a attendu longtemps le plat.', ['attente']],
      [5, null, []],
      [3, 'Bon mais un peu cher.', ['prix']],
    ] as const;
    await prisma.feedback.createMany({
      data: comments.map(([rating, comment, tags], k) => ({
        restaurantId: restaurant.id,
        rating,
        comment,
        tags: [...tags],
        tableLabel: tables[k % tables.length].label,
        createdAt: new Date(now - (k + 1) * DAY * 2),
      })),
    });

    console.log(
      `${loc.restaurant.padEnd(34)} ${loc.key}${DOMAIN}  /m/${loc.slug}  ${tables.length} tables, ${dishIds.length} dishes, ${loc.locales.join('/')}`,
    );
  }
  console.log(
    `\nPassword for every seed account: ${PASSWORD}` +
      (removed.count
        ? `  (replaced ${removed.count} older seed accounts)`
        : ''),
  );
  console.log(
    'Admin console: log in with an email listed in ADMIN_EMAILS of your local env.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
