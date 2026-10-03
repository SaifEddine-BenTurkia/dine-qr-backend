#!/usr/bin/env node
/**
 * npm run secrets:scan [-- extra-dir ...]
 *
 * Scans every tracked file (and any extra directory, such as a build output)
 * for credential patterns. Prints file, line and the kind of secret, never
 * the value. Exit code 1 when something is found. A line can be allowed with
 * a `secrets-scan: allow` comment.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const KINDS = [
  ['OpenRouter key', /sk-or-v1-[A-Za-z0-9]{20,}/],
  ['Resend key', /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9_]{10,}/],
  ['Stripe-style live key', /\b(sk|pk|rk)_live_[A-Za-z0-9]{10,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  [
    'GitHub token',
    /\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/,
  ],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Cloudinary URL', /cloudinary:\/\/\d+:[A-Za-z0-9_-]{10,}@/],
  // Database URLs with a password, except local and CI throwaway databases.
  [
    'Database URL with password',
    /postgres(?:ql)?:\/\/[^:\s/]+:(?!\$\{)[^@\s]{3,}@(?!localhost|127\.0\.0\.1|postgres:|db:)[^\s'"]+/,
  ],
];

const SKIP =
  /(^|\/)(node_modules|\.git)\/|package-lock\.json$|\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const extra = process.argv
  .slice(2)
  .filter((dir) => existsSync(dir))
  .flatMap((dir) => walk(dir));

let found = 0;
for (const file of [...new Set([...tracked, ...extra])]) {
  const normalized = file.replace(/\\/g, '/');
  if (SKIP.test(normalized) || !existsSync(file)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.includes('secrets-scan: allow')) return;
    for (const [kind, pattern] of KINDS) {
      if (pattern.test(line)) {
        found++;
        console.log(`${normalized}:${index + 1}  ${kind}`);
      }
    }
  });
}

console.log(
  found ? `FAIL: ${found} possible secret(s)` : 'OK: no secrets found',
);
process.exit(found ? 1 : 0);
