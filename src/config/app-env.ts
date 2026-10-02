type Environment = Record<string, string | undefined>;

export const APP_ENVS = ['development', 'prelaunch', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/**
 * Which kind of deployment this is (PLAN section 20). Until the first paying
 * customer every environment, the VPS included, runs on sandbox or capped
 * keys. A server without APP_ENV is treated as prelaunch, never production.
 */
export function resolveAppEnv(environment: Environment): AppEnv {
  const value = environment.APP_ENV?.trim();
  if (value) {
    if (!(APP_ENVS as readonly string[]).includes(value)) {
      throw new Error(`APP_ENV must be one of: ${APP_ENVS.join(', ')}`);
    }
    return value as AppEnv;
  }
  return environment.NODE_ENV === 'production' ? 'prelaunch' : 'development';
}

export const isSandbox = (appEnv: AppEnv) => appEnv !== 'production';

// Key formats that only exist for live accounts.
const LIVE_KEY_MARKERS = /\b(sk|pk|rk)_live_/;

const KONNECT_SANDBOX_HOST = 'api.sandbox.konnect.network';

/**
 * Problems with the provider modes, as `NAME reason` strings. Values are
 * never included, only variable names.
 */
export function modeProblems(environment: Environment): string[] {
  const appEnv = resolveAppEnv(environment);
  const problems: string[] = [];
  const get = (key: string) => environment[key]?.trim() || undefined;

  if (appEnv === 'production' && environment.NODE_ENV !== 'production') {
    problems.push('APP_ENV production requires NODE_ENV=production');
  }

  const flouci = get('FLOUCI_ENV');
  const konnect = get('KONNECT_API_URL');
  const google = get('GOOGLE_REVIEWS_WRITE_MODE');
  let konnectHost: string | undefined;
  if (konnect) {
    try {
      konnectHost = new URL(konnect).host;
    } catch {
      problems.push('KONNECT_API_URL is not a valid URL');
    }
  }

  if (isSandbox(appEnv)) {
    if (flouci && flouci !== 'test') {
      problems.push(`FLOUCI_ENV must be "test" when APP_ENV=${appEnv}`);
    }
    if (konnectHost && konnectHost !== KONNECT_SANDBOX_HOST) {
      problems.push(
        `KONNECT_API_URL must use the sandbox host when APP_ENV=${appEnv}`,
      );
    }
    if (google && google !== 'dry_run') {
      problems.push(
        `GOOGLE_REVIEWS_WRITE_MODE must be "dry_run" when APP_ENV=${appEnv}`,
      );
    }
    for (const [key, value] of Object.entries(environment)) {
      if (value && LIVE_KEY_MARKERS.test(value)) {
        problems.push(`${key} looks like a live key (APP_ENV=${appEnv})`);
      }
    }
  } else {
    if (flouci === 'test') {
      problems.push('FLOUCI_ENV is "test" in production');
    }
    if (konnectHost === KONNECT_SANDBOX_HOST) {
      problems.push('KONNECT_API_URL uses the sandbox host in production');
    }
    if (google === 'dry_run') {
      problems.push('GOOGLE_REVIEWS_WRITE_MODE is "dry_run" in production');
    }
  }
  return problems;
}
