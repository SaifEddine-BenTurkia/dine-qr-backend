import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The website can only call the methods CORS allows (app.setup.ts). A route
// with another method passes the server tests and fails in every browser.
const FORBIDDEN = ['Put', 'All', 'Head', 'Options'];

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return controllers(path);
    return /controllers?\.ts$/.test(name) ? [path] : [];
  });
}

describe('HTTP methods', () => {
  it('only uses methods the browser is allowed to send', () => {
    const offenders: string[] = [];
    for (const file of controllers(join(__dirname, '..'))) {
      const source = readFileSync(file, 'utf8');
      for (const decorator of FORBIDDEN) {
        if (source.includes(`@${decorator}(`)) {
          offenders.push(`${file}: @${decorator}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the CORS list in line with this test', () => {
    const setup = readFileSync(join(__dirname, '..', 'app.setup.ts'), 'utf8');
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      expect(setup).toContain(`'${method}'`);
    }
  });
});
