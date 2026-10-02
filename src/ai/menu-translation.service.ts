import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isLocale, type Locale, type Translations } from '../common/locales';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import { AiService } from './ai.service';

const LANGUAGE_NAMES: Record<Locale, string> = {
  fr: 'French',
  ar: 'Modern Standard Arabic',
  en: 'English',
  de: 'German',
  it: 'Italian',
  ru: 'Russian',
};

// Tunisian dishes keep their name; tourists get a short explanation (P1-03).
// The owner extends this list in prompts/glossary later.
export const TUNISIAN_GLOSSARY = [
  'brik',
  'lablabi',
  'ojja',
  'kafteji',
  'mloukhia',
  'couscous',
  'chakchouka',
  'makroudh',
  'bambalouni',
  'fricassé',
  'mechouia',
  'tajine',
  'bsissa',
  'assida',
  'zrir',
  'kammounia',
  'mirmiz',
  'chorba',
];

export function translationPrompt(
  locale: Locale,
  items: { id: string; name: string; description: string | null }[],
) {
  return `You translate a restaurant menu from French into ${LANGUAGE_NAMES[locale]}.
Rules:
- Keep Tunisian dish names in their original form (for example: ${TUNISIAN_GLOSSARY.join(', ')}). Write the name, then " — " and a short explanation in ${LANGUAGE_NAMES[locale]}, e.g. "Brik — crispy pastry with egg and tuna".
- Translate other dish names naturally and briefly. Never invent ingredients.
- Keep prices, numbers and brand names unchanged.
- Return ONLY a JSON array with one object per input item, same ids:
  [{"id": "...", "name": "...", "description": "..." or null}]

Items:
${JSON.stringify(items)}`;
}

/** Parses the model's JSON answer, tolerating code fences around it. */
export function parseTranslationReply(
  reply: string,
): { id: string; name: string; description: string | null }[] {
  const start = reply.indexOf('[');
  const end = reply.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error('No JSON array');
  const parsed: unknown = JSON.parse(reply.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Not an array');
  return parsed
    .filter(
      (row): row is { id: string; name: string; description?: unknown } =>
        typeof row === 'object' &&
        row !== null &&
        typeof (row as { id?: unknown }).id === 'string' &&
        typeof (row as { name?: unknown }).name === 'string',
    )
    .map((row) => ({
      id: row.id,
      name: row.name.trim().slice(0, 120),
      description:
        typeof row.description === 'string' && row.description.trim()
          ? row.description.trim().slice(0, 1000)
          : null,
    }));
}

const BATCH = 30;

/**
 * "Traduire en anglais" (P1-03): fills one language for every category and
 * dish of the restaurant. Existing owner translations are kept unless
 * `overwrite` is set; AI results are flagged in aiLocales until checked.
 */
@Injectable()
export class MenuTranslationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly ai: AiService,
  ) {}

  async translateMenu(userId: string, locale: string, overwrite = false) {
    if (!isLocale(locale) || locale === 'fr') {
      throw new BadRequestException('Langue non prise en charge');
    }
    const restaurantId = await this.access.restaurantIdFor(userId);
    const [categories, dishes] = await Promise.all([
      this.prisma.category.findMany({ where: { restaurantId } }),
      this.prisma.dish.findMany({ where: { category: { restaurantId } } }),
    ]);

    const has = (value: Prisma.JsonValue | null) =>
      !!(value as Translations | null)?.[locale];
    const items = [
      ...categories
        .filter((c) => overwrite || !has(c.nameI18n))
        .map((c) => ({ id: `c:${c.id}`, name: c.name, description: null })),
      ...dishes
        .filter((d) => overwrite || !has(d.nameI18n))
        .map((d) => ({
          id: `d:${d.id}`,
          name: d.name,
          description: d.description,
        })),
    ];
    if (items.length === 0) return { translated: 0 };

    let translated = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const reply = await this.ai.complete([
        { type: 'text', text: translationPrompt(locale, batch) },
      ]);
      let rows: ReturnType<typeof parseTranslationReply>;
      try {
        rows = parseTranslationReply(reply);
      } catch {
        throw new UnprocessableEntityException(
          'La traduction automatique a échoué, réessayez',
        );
      }
      const wanted = new Set(batch.map((item) => item.id));
      for (const row of rows.filter((r) => wanted.has(r.id))) {
        const [kind, id] = row.id.split(':');
        if (kind === 'c') {
          const category = categories.find((c) => c.id === id)!;
          await this.prisma.category.update({
            where: { id },
            data: {
              nameI18n: { ...asObject(category.nameI18n), [locale]: row.name },
              aiLocales: addLocale(category.aiLocales, locale),
            },
          });
        } else {
          const dish = dishes.find((d) => d.id === id)!;
          await this.prisma.dish.update({
            where: { id },
            data: {
              nameI18n: { ...asObject(dish.nameI18n), [locale]: row.name },
              descriptionI18n: row.description
                ? {
                    ...asObject(dish.descriptionI18n),
                    [locale]: row.description,
                  }
                : (dish.descriptionI18n ?? Prisma.DbNull),
              aiLocales: addLocale(dish.aiLocales, locale),
            },
          });
        }
        translated++;
      }
    }
    // Offer the language on the guest menu.
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { enabledLocales: true },
    });
    if (!restaurant.enabledLocales.includes(locale)) {
      await this.prisma.restaurant.update({
        where: { id: restaurantId },
        data: { enabledLocales: [...restaurant.enabledLocales, locale] },
      });
    }
    return { translated };
  }
}

const asObject = (value: Prisma.JsonValue | null): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};

const addLocale = (list: string[], locale: string) =>
  list.includes(locale) ? list : [...list, locale];
