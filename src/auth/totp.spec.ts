import {
  base32Decode,
  base32Encode,
  matchTotp,
  newTotpSecret,
  openSecret,
  otpauthUrl,
  sealSecret,
  totpCode,
} from './totp';

// RFC 6238 appendix B, SHA-1 seed "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('matches the RFC 6238 test vectors', () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30), 8)).toBe('94287082');
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30), 8)).toBe(
      '07081804',
    );
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30), 8)).toBe(
      '69279037',
    );
  });

  it('round-trips base32', () => {
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it('accepts the current code and one step of drift, nothing older', () => {
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    const secret = newTotpSecret();
    expect(matchTotp(secret, totpCode(secret, step), now)).toBe(step);
    expect(matchTotp(secret, totpCode(secret, step - 1), now)).toBe(step - 1);
    expect(matchTotp(secret, totpCode(secret, step - 3), now)).toBeNull();
    expect(matchTotp(secret, 'abcdef', now)).toBeNull();
  });

  it('stores secrets encrypted and refuses another server key', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', 'server-key-1');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(openSecret(sealed, 'server-key-1')).toBe('JBSWY3DPEHPK3PXP');
    expect(() => openSecret(sealed, 'server-key-2')).toThrow();
  });

  it('builds the URL authenticator apps scan', () => {
    expect(otpauthUrl('ABC', 'a@b.c', 'TableQR admin')).toBe(
      'otpauth://totp/TableQR%20admin%3Aa%40b.c?secret=ABC&issuer=TableQR%20admin&algorithm=SHA1&digits=6&period=30',
    );
  });
});
