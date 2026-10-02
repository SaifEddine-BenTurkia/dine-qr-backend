import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export type Env = Record<string, string | undefined>;

/**
 * Loads the env file the API itself would load (`.env.sandbox`, else `.env`),
 * without printing anything. Real process variables win, like in the app.
 */
export function loadEnv(file?: string): { file: string | null; env: Env } {
  const candidates = file ? [file] : ['.env.sandbox', '.env'];
  const found = candidates.find((candidate) => existsSync(candidate)) ?? null;
  const fromFile = found
    ? (parseEnv(readFileSync(found, 'utf8')) as Env)
    : ({} as Env);
  return { file: found, env: { ...fromFile, ...process.env } };
}

/** The variable names written in an env file, values ignored. */
export function namesIn(file: string | null): string[] {
  if (!file) return [];
  return Object.keys(parseEnv(readFileSync(file, 'utf8')));
}
