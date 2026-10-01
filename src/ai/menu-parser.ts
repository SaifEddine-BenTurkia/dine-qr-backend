export interface ParsedDish {
  categoryName: string;
  name: string;
  description: string | null;
  price: number;
}

const MAX_DISHES = 300;

/**
 * Turns a model reply into a clean list of dishes.
 *
 * Models wrap JSON in code fences, prepend reasoning in <think> blocks, or add a
 * sentence before the array, so the array is cut out of the text before
 * parsing. Every field is then checked: the result is written to the database
 * by the client, so nothing here is trusted as-is.
 */
export function parseMenuReply(reply: string): ParsedDish[] {
  const withoutThinking = reply.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const start = withoutThinking.indexOf('[');
  const end = withoutThinking.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error('No JSON array in model reply');
  }

  const parsed: unknown = JSON.parse(withoutThinking.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Model reply is not an array');

  const dishes: ParsedDish[] = [];
  for (const item of parsed.slice(0, MAX_DISHES)) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const name = text(record.name, 120);
    if (!name) continue;
    const price = Number(record.price);
    dishes.push({
      categoryName: text(record.categoryName, 80) || 'Menu',
      name,
      description: text(record.description, 1000) || null,
      price:
        Number.isFinite(price) && price >= 0
          ? Math.round(price * 1000) / 1000
          : 0,
    });
  }
  return dishes;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
