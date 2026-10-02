/**
 * npm run smoke
 *
 * One line per service configured in the local env: OK, FAIL (with the HTTP
 * status) or SKIP. Read-only calls only; values are never printed.
 */
import { PrismaClient } from '@prisma/client';
import { loadEnv } from './load-env';

const { env } = loadEnv();
let failed = false;

function report(name: string, result: string) {
  if (result.startsWith('FAIL')) failed = true;
  console.log(`${result.padEnd(24)} ${name}`);
}

async function http(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    let name = '';
    try {
      name = ((await res.json()) as { name?: string }).name ?? '';
    } catch {
      // Body is not JSON; the status is enough.
    }
    return { status: res.status, name };
  } catch {
    return { status: 0, name: 'network' };
  }
}

async function database() {
  if (!env.DATABASE_URL) return report('database', 'SKIP (not configured)');
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    await prisma.$queryRaw`SELECT 1`;
    report('database', 'OK');
  } catch {
    report('database', 'FAIL (unreachable)');
  } finally {
    await prisma.$disconnect();
  }
}

async function resend() {
  if (!env.RESEND_API_KEY) return report('resend', 'SKIP (not configured)');
  const { status, name } = await http('https://api.resend.com/domains', {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
  });
  // A sending-only key cannot list domains; Resend says so, which proves the
  // key itself is valid.
  const ok =
    status === 200 || (status === 401 && name === 'restricted_api_key');
  report('resend', ok ? 'OK' : `FAIL (http ${status})`);
}

async function openrouter() {
  const keys = (env.OPENROUTER_API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  if (keys.length === 0) return report('openrouter', 'SKIP (not configured)');
  for (const [index, key] of keys.entries()) {
    const { status } = await http('https://openrouter.ai/api/v1/key', {
      Authorization: `Bearer ${key}`,
    });
    report(
      `openrouter key ${index + 1}`,
      status === 200 ? 'OK' : `FAIL (http ${status})`,
    );
  }
}

async function cloudinary() {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return report('cloudinary', 'SKIP (not configured)');
  }
  const auth = Buffer.from(
    `${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`,
  ).toString('base64');
  const { status } = await http(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/ping`,
    { Authorization: `Basic ${auth}` },
  );
  report('cloudinary', status === 200 ? 'OK' : `FAIL (http ${status})`);
}

async function main() {
  await database();
  await resend();
  await openrouter();
  await cloudinary();
  process.exit(failed ? 1 : 0);
}

void main();
