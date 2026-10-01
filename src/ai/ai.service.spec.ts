import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const file = {
  mimetype: 'image/png',
  buffer: Buffer.from('png'),
} as Express.Multer.File;

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const completion = (content: string) => ({
  choices: [{ message: { content } }],
});

// OpenRouter's shape for an overloaded free model: HTTP 200, no choices.
const overloaded = {
  error: {
    message: 'Upstream error from Nvidia: ResourceExhausted',
    code: 502,
  },
};

describe('AiService', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  const service = () =>
    new AiService(
      config({
        OPENROUTER_API_KEYS: 'key-a,key-b',
        OPENROUTER_MODEL: 'free/model-1, free/model-2',
      }),
    );

  const modelOf = (call: number) =>
    (
      JSON.parse(fetchMock.mock.calls[call][1]?.body as string) as {
        model: string;
      }
    ).model;

  it('falls back to the next model when the first is overloaded', async () => {
    fetchMock
      .mockImplementationOnce(() => reply(overloaded))
      .mockImplementationOnce(() => reply(overloaded))
      .mockImplementationOnce(() =>
        reply(
          completion('[{"categoryName":"Plats","name":"Ojja","price":14}]'),
        ),
      );

    await expect(service().parseMenuImage(file)).resolves.toEqual([
      { categoryName: 'Plats', name: 'Ojja', description: null, price: 14 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(modelOf(0)).toBe('free/model-1');
    expect(modelOf(2)).toBe('free/model-2');
  });

  it('reports a provider outage as 503, not as an unreadable menu', async () => {
    fetchMock.mockImplementation(() => reply(overloaded));
    await expect(service().parseMenuImage(file)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('reports an empty answer as an unreadable menu (422)', async () => {
    fetchMock.mockImplementation(() => reply(completion('')));
    await expect(service().parseMenuImage(file)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
