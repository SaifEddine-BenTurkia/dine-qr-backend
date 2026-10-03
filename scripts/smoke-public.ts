/**
 * npm run smoke:public -- [api-url] [frontend-url] [slug]
 *
 * Checks a deployment from the outside: API health, the guest menu API and
 * the frontend. Used after every merge to main. Without a slug, the guest
 * menu is checked with an unknown one (404 proves the route answers).
 */
const api = (process.argv[2] ?? 'https://menu-api.arishub.site').replace(
  /\/$/,
  '',
);
const web = (process.argv[3] ?? 'https://menu.arishub.site').replace(/\/$/, '');
const slug = process.argv[4];

let failed = false;

/** `contains`: text the body must hold (the frontend answers 200 to any path). */
async function check(
  name: string,
  url: string,
  accept: number[],
  contains?: string,
) {
  let status = 0;
  let body = '';
  for (let attempt = 0; attempt < 3 && status === 0; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      status = res.status;
      if (contains) body = await res.text();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  const ok = accept.includes(status) && (!contains || body.includes(contains));
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(status).padEnd(4)} ${name}`);
}

async function main() {
  await check('api ready', `${api}/health/ready`, [200]);
  if (slug) {
    // 402 is a live answer too: the test menu's trial may have ended.
    await check(
      `guest menu api (${slug})`,
      `${api}/public/menu/${slug}`,
      [200, 402],
    );
  } else {
    await check(
      'guest menu api (unknown slug)',
      `${api}/public/menu/smoke-no-such-menu`,
      [404],
    );
  }
  // The console must not admit it exists to an anonymous caller.
  await check('admin api hidden', `${api}/admin/overview`, [404]);
  // Routes of the latest release: 401 proves they are deployed (404 = old build).
  await check('notifications api', `${api}/push/key`, [401]);
  await check('loyalty api', `${api}/loyalty/program`, [401]);
  await check('stock api', `${api}/stock`, [401]);
  await check('frontend', `${web}/`, [200]);
  await check(
    'service worker',
    `${web}/sw.js`,
    [200],
    'addEventListener("push"',
  );
  await check(
    'staff app manifest',
    `${web}/staff.webmanifest`,
    [200],
    '"start_url"',
  );
  await check(
    `guest menu page (${slug ?? 'any'})`,
    `${web}/m/${slug ?? 'smoke-no-such-menu'}`,
    [200],
  );
  process.exit(failed ? 1 : 0);
}

void main();
