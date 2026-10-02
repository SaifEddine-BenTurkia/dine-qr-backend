import { ConsoleLogger } from '@nestjs/common';

// Variables whose values must never reach a log line.
const SECRET_NAME = /(KEY|SECRET|TOKEN|PASSWORD|SALT|DATABASE_URL)/;

// Known credential formats, masked even when they did not come from the env.
const PATTERNS: [RegExp, string][] = [
  [/sk-or-v1-[A-Za-z0-9]{8,}/g, 'sk-or-v1-[redacted]'],
  [/\bre_[A-Za-z0-9_]{16,}/g, 're_[redacted]'],
  [/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/g, '$1_$2_[redacted]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]'],
  [/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/g, '$1[redacted]@'],
  // Personal data: email addresses become j***@example.com.
  [
    /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    '$1***@$2',
  ],
];

export function secretValues(environment: NodeJS.ProcessEnv): string[] {
  return Object.entries(environment)
    .filter(([name, value]) => SECRET_NAME.test(name) && value)
    .flatMap(([, value]) => (value as string).split(','))
    .map((value) => value.trim())
    .filter((value) => value.length >= 8)
    .sort((a, b) => b.length - a.length);
}

export function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) out = out.split(secret).join('[redacted]');
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function redactValue(value: unknown, secrets: string[]): unknown {
  if (typeof value === 'string') return redact(value, secrets);
  if (value instanceof Error) {
    const copy = new Error(redact(value.message, secrets));
    copy.name = value.name;
    copy.stack = value.stack ? redact(value.stack, secrets) : undefined;
    return copy;
  }
  return value;
}

/**
 * The app logger (PLAN section 20, guard 4): masks every secret-like env
 * value, known key formats, bearer tokens and email addresses before Nest
 * prints anything.
 */
export class RedactingLogger extends ConsoleLogger {
  private readonly secrets = secretValues(process.env);

  private clean(message: unknown, params: unknown[]) {
    return [
      redactValue(message, this.secrets),
      ...params.map((param) => redactValue(param, this.secrets)),
    ] as [unknown, ...unknown[]];
  }

  log(message: unknown, ...params: unknown[]) {
    super.log(...this.clean(message, params));
  }
  error(message: unknown, ...params: unknown[]) {
    super.error(...this.clean(message, params));
  }
  warn(message: unknown, ...params: unknown[]) {
    super.warn(...this.clean(message, params));
  }
  debug(message: unknown, ...params: unknown[]) {
    super.debug(...this.clean(message, params));
  }
  verbose(message: unknown, ...params: unknown[]) {
    super.verbose(...this.clean(message, params));
  }
  fatal(message: unknown, ...params: unknown[]) {
    super.fatal(...this.clean(message, params));
  }
}
