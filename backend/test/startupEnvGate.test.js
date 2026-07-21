const { validateStartupEnv, assertStartupEnv } = require('../utils/startupEnvGate');

describe('startup env gate', () => {
  const validProductionEnv = {
    NODE_ENV: 'production',
    NETWORK: 'mainnet',
    EMAIL_AUTH_JWT_SECRET: 'real-email-jwt-secret',
    NEXTAUTH_SECRET: 'real-nextauth-secret',
  };

  describe('NETWORK', () => {
    it('fails when NETWORK is unset', () => {
      const errors = validateStartupEnv({ NODE_ENV: 'development' });
      expect(errors).toContain('NETWORK must be exactly "mainnet" or "testnet"');
    });

    it('fails when NETWORK is invalid', () => {
      const errors = validateStartupEnv({ NODE_ENV: 'development', NETWORK: 'staging' });
      expect(errors).toContain('NETWORK must be exactly "mainnet" or "testnet"');
    });

    it('passes when NETWORK is mainnet', () => {
      const errors = validateStartupEnv({ NODE_ENV: 'development', NETWORK: 'mainnet' });
      expect(errors).toEqual([]);
    });

    it('passes when NETWORK is testnet', () => {
      const errors = validateStartupEnv({ NODE_ENV: 'development', NETWORK: 'testnet' });
      expect(errors).toEqual([]);
    });
  });

  describe('production auth secrets', () => {
    it('fails when EMAIL_AUTH_JWT_SECRET is unset in production', () => {
      const env = { ...validProductionEnv };
      delete env.EMAIL_AUTH_JWT_SECRET;
      const errors = validateStartupEnv(env);
      expect(errors.some((e) => e.includes('EMAIL_AUTH_JWT_SECRET'))).toBe(true);
    });

    it('fails when EMAIL_AUTH_JWT_SECRET is the development placeholder in production', () => {
      const errors = validateStartupEnv({
        ...validProductionEnv,
        EMAIL_AUTH_JWT_SECRET: 'change-me-in-env',
      });
      expect(errors.some((e) => e.includes('EMAIL_AUTH_JWT_SECRET'))).toBe(true);
    });

    it('fails when NEXTAUTH_SECRET is unset in production', () => {
      const env = { ...validProductionEnv };
      delete env.NEXTAUTH_SECRET;
      const errors = validateStartupEnv(env);
      expect(errors.some((e) => e.includes('NEXTAUTH_SECRET'))).toBe(true);
    });

    it('fails when NEXTAUTH_SECRET is the development placeholder in production', () => {
      const errors = validateStartupEnv({
        ...validProductionEnv,
        NEXTAUTH_SECRET: 'fallback-secret-for-development',
      });
      expect(errors.some((e) => e.includes('NEXTAUTH_SECRET'))).toBe(true);
    });

    it('passes with real secrets in production', () => {
      const errors = validateStartupEnv(validProductionEnv);
      expect(errors).toEqual([]);
    });
  });

  describe('non-production', () => {
    it('passes with placeholder secrets when NODE_ENV is development', () => {
      const errors = validateStartupEnv({
        NODE_ENV: 'development',
        NETWORK: 'testnet',
        EMAIL_AUTH_JWT_SECRET: 'change-me-in-env',
        NEXTAUTH_SECRET: 'fallback-secret-for-development',
      });
      expect(errors).toEqual([]);
    });

    it('passes with unset auth secrets when NODE_ENV is test', () => {
      const errors = validateStartupEnv({
        NODE_ENV: 'test',
        NETWORK: 'testnet',
      });
      expect(errors).toEqual([]);
    });
  });

  describe('assertStartupEnv', () => {
    it('throws when validation fails', () => {
      expect(() => assertStartupEnv({ NODE_ENV: 'development' })).toThrow(
        /NETWORK must be exactly/
      );
    });

    it('does not throw when validation passes', () => {
      expect(() =>
        assertStartupEnv({ NODE_ENV: 'development', NETWORK: 'testnet' })
      ).not.toThrow();
    });
  });
});
