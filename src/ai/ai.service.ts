import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseMenuReply, type ParsedDish } from './menu-parser';

const PROMPT = `You are a menu parser. Extract all dishes from this menu image.
Return ONLY a valid JSON array, no explanation, no markdown, no backticks.
Format:
[
  {
    "categoryName": "Entrées",
    "name": "Salade niçoise",
    "description": "Thon, olives, œufs",
    "price": 12.5
  }
]
Rules:
- If price is not visible, use 0
- If description is not visible, use null
- Group dishes under their category name as written in the menu
- Return ONLY the JSON array, nothing else`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly keys: string[];
  private readonly models: string[];
  private nextKey = 0;

  constructor(config: ConfigService) {
    this.keys = (config.get<string>('OPENROUTER_API_KEYS') ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    // Comma-separated, tried in order: free models are often saturated, so
    // later entries are fallbacks.
    this.models = (
      config.get<string>('OPENROUTER_MODEL') ??
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
    )
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);
  }

  async parseMenuImage(file: Express.Multer.File): Promise<ParsedDish[]> {
    if (this.keys.length === 0) {
      throw new ServiceUnavailableException("L'import IA n'est pas configuré");
    }

    const reply = await this.complete(
      `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
    );

    let dishes: ParsedDish[];
    try {
      dishes = parseMenuReply(reply);
    } catch {
      throw new UnprocessableEntityException(
        'Impossible de lire ce menu, essayez une photo plus nette',
      );
    }
    if (dishes.length === 0) {
      throw new UnprocessableEntityException('Aucun plat détecté');
    }
    return dishes;
  }

  // Each model is tried with every key before moving to the next model:
  // free-tier keys are rate limited individually, and free models are often
  // saturated upstream.
  private async complete(imageDataUrl: string): Promise<string> {
    for (const model of this.models) {
      for (let attempt = 0; attempt < this.keys.length; attempt++) {
        const key = this.keys[this.nextKey];
        this.nextKey = (this.nextKey + 1) % this.keys.length;
        try {
          return await this.request(model, key, imageDataUrl);
        } catch (error) {
          this.logger.warn(
            `OpenRouter ${model} (key ${attempt + 1}) failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
    // 503, not 502: Cloudflare replaces 502 responses with its own HTML page,
    // and the owner would never see this message.
    throw new ServiceUnavailableException(
      "Le service d'IA est indisponible, réessayez plus tard",
    );
  }

  private async request(model: string, key: string, imageDataUrl: string) {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: imageDataUrl } },
                { type: 'text', text: PROMPT },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string | null } }[];
    };
    // OpenRouter reports upstream failures (an overloaded free model, for
    // one) as HTTP 200 with an error object and no choices.
    if (data.error || !data.choices?.length) {
      throw new Error(data.error?.message ?? 'No completion returned');
    }
    // An empty answer is the model failing to read the image, not the
    // provider being down: the caller reports it as an unreadable menu.
    return data.choices[0].message?.content ?? '';
  }
}
