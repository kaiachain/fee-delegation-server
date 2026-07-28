const { createTestAgent } = require('./helpers/app');
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

  describe('POST /api/email-auth/login (HTTP)', () => {
    it('rejects overlong email quickly via middleware', async () => {
      const agent = createTestAgent();
      const longEmail = `${'x'.repeat(300)}@example.com`;

      const start = Date.now();
      const res = await agent
        .post('/api/email-auth/login')
        .send({ email: longEmail, password: 'password123' });
      const elapsed = Date.now() - start;

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BAD_REQUEST');
      expect(elapsed).toBeLessThan(200);
    });

    it('still accepts a normal-length email through validation middleware', async () => {
      const agent = createTestAgent();
      const res = await agent
        .post('/api/email-auth/reset-password')
        .send({ email: 'nobody@example.com' });

      // Unknown user => success without leak, not invalid email format.
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
    });
  });

  describe('POST /api/email-auth/reset-password (HTTP)', () => {
    it('rejects overlong email quickly', async () => {
      const agent = createTestAgent();
      const longEmail = `${'x'.repeat(300)}@example.com`;

      const start = Date.now();
      const res = await agent
        .post('/api/email-auth/reset-password')
        .send({ email: longEmail });
      const elapsed = Date.now() - start;

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BAD_REQUEST');
      expect(elapsed).toBeLessThan(200);
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
