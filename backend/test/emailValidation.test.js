const { withEnv } = require('./helpers/env');

describe('email validation', () => {
  describe('isValidEmail (unit)', () => {
    const { isValidEmail, MAX_EMAIL_LENGTH } = require('../utils/emailValidation');

    it('accepts normal emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('first.last+tag@sub.example.co.uk')).toBe(true);
    });

    it('rejects emails longer than max length without hanging', () => {
      const longLocal = 'a'.repeat(MAX_EMAIL_LENGTH);
      const longEmail = `${longLocal}@example.com`;

      const start = Date.now();
      expect(isValidEmail(longEmail)).toBe(false);
      expect(Date.now() - start).toBeLessThan(50);
    });

    it('rejects ReDoS-ish long malformed input quickly', () => {
      const evil = `${'a'.repeat(10_000)}@${'b'.repeat(10_000)}`;

      const start = Date.now();
      expect(isValidEmail(evil)).toBe(false);
      expect(Date.now() - start).toBeLessThan(50);
    });

    it('rejects non-strings and malformed addresses', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@missing.local')).toBe(false);
    });
  });

});

describe('GOOGLE_WHITELIST trim', () => {
  const { parseGoogleWhitelist } = require('../utils/googleWhitelist');

  it('trims entries after split', () => {
    expect(parseGoogleWhitelist(' admin@example.com , viewer@example.com ')).toEqual([
      'admin@example.com',
      'viewer@example.com',
    ]);
  });

  it('matches trimmed whitelist entries from env', async () => {
    await withEnv({ GOOGLE_WHITELIST: ' admin@example.com ' }, async () => {
      const { isGoogleWhitelistEmail } = require('../utils/googleWhitelist');
      expect(isGoogleWhitelistEmail('admin@example.com')).toBe(true);
      expect(isGoogleWhitelistEmail('other@example.com')).toBe(false);
    });
  });
});

describe('GOOGLE_ALLOWED_HD hosted-domain enforcement', () => {
  const { isAllowedHostedDomain } = require('../utils/googleWhitelist');

  it('defaults to kaia.io when GOOGLE_ALLOWED_HD is unset or blank', () => {
    for (const unset of [undefined, '', '  ,  ']) {
      expect(isAllowedHostedDomain('kaia.io', unset)).toBe(true);
      expect(isAllowedHostedDomain('evil.com', unset)).toBe(false);
      // A missing env var must not widen access to consumer accounts.
      expect(isAllowedHostedDomain(undefined, unset)).toBe(false);
    }
  });

  it("only '*' disables the check", () => {
    expect(isAllowedHostedDomain('evil.com', '*')).toBe(true);
    expect(isAllowedHostedDomain(undefined, '*')).toBe(true);
    expect(isAllowedHostedDomain(undefined, 'kaia.io,*')).toBe(true);
  });

  it('an explicit list replaces the kaia.io default', () => {
    expect(isAllowedHostedDomain('other.com', 'other.com')).toBe(true);
    expect(isAllowedHostedDomain('kaia.io', 'other.com')).toBe(false);
  });

  it('accepts a matching hosted domain when configured', () => {
    expect(isAllowedHostedDomain('kaia.io', 'kaia.io')).toBe(true);
    expect(isAllowedHostedDomain('kaia.io', ' kaia.io , krustuniverse.com ')).toBe(true);
    expect(isAllowedHostedDomain('krustuniverse.com', 'kaia.io,krustuniverse.com')).toBe(true);
  });

  it('is case-insensitive on both sides', () => {
    expect(isAllowedHostedDomain('KAIA.IO', 'kaia.io')).toBe(true);
    expect(isAllowedHostedDomain('kaia.io', 'KAIA.IO')).toBe(true);
  });

  it('denies a non-matching hosted domain', () => {
    expect(isAllowedHostedDomain('evil.com', 'kaia.io')).toBe(false);
    expect(isAllowedHostedDomain('kaia.io.evil.com', 'kaia.io')).toBe(false);
    expect(isAllowedHostedDomain('xkaia.io', 'kaia.io')).toBe(false);
  });

  it('denies consumer accounts (no hd claim) once configured', () => {
    expect(isAllowedHostedDomain(undefined, 'kaia.io')).toBe(false);
    expect(isAllowedHostedDomain(null, 'kaia.io')).toBe(false);
    expect(isAllowedHostedDomain('', 'kaia.io')).toBe(false);
  });

  it('denies non-string hd claims', () => {
    expect(isAllowedHostedDomain(['kaia.io'], 'kaia.io')).toBe(false);
    expect(isAllowedHostedDomain({ hd: 'kaia.io' }, 'kaia.io')).toBe(false);
    expect(isAllowedHostedDomain(true, 'kaia.io')).toBe(false);
  });

  it('reads GOOGLE_ALLOWED_HD from the environment', async () => {
    await withEnv({ GOOGLE_ALLOWED_HD: 'other.com' }, async () => {
      expect(isAllowedHostedDomain('other.com')).toBe(true);
      expect(isAllowedHostedDomain('kaia.io')).toBe(false);
      expect(isAllowedHostedDomain(undefined)).toBe(false);
    });
  });

  it('enforces the kaia.io default when the env var is absent', async () => {
    await withEnv({ GOOGLE_ALLOWED_HD: undefined }, async () => {
      expect(isAllowedHostedDomain('kaia.io')).toBe(true);
      expect(isAllowedHostedDomain('evil.com')).toBe(false);
      expect(isAllowedHostedDomain(undefined)).toBe(false);
    });
  });
});
