import { createHmac } from 'node:crypto';
import { verifyPaddleSignature } from './paddle';

const secret = 'pdl_ntfset_test_secret';
const body = Buffer.from('{"event_id":"evt_1"}');
const now = 1_760_000_000;

function sign(ts: number, payload = body, key = secret) {
  const h1 = createHmac('sha256', key)
    .update(`${ts}:`)
    .update(payload)
    .digest('hex');
  return `ts=${ts};h1=${h1}`;
}

describe('verifyPaddleSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifyPaddleSignature(sign(now), body, secret, now)).toBe(true);
  });

  it('accepts any of several signatures during secret rotation', () => {
    const header = `${sign(now, body, 'old-secret')};h1=${sign(now).split('h1=')[1]}`;
    expect(verifyPaddleSignature(header, body, secret, now)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(
      verifyPaddleSignature(sign(now), Buffer.from('{"x":1}'), secret, now),
    ).toBe(false);
  });

  it('rejects the wrong secret', () => {
    expect(
      verifyPaddleSignature(sign(now, body, 'other'), body, secret, now),
    ).toBe(false);
  });

  it('rejects stale timestamps', () => {
    expect(verifyPaddleSignature(sign(now - 3600), body, secret, now)).toBe(
      false,
    );
  });

  it('rejects missing or malformed headers', () => {
    expect(verifyPaddleSignature(undefined, body, secret, now)).toBe(false);
    expect(verifyPaddleSignature('garbage', body, secret, now)).toBe(false);
    expect(verifyPaddleSignature(`ts=${now};h1=zz`, body, secret, now)).toBe(
      false,
    );
  });
});
