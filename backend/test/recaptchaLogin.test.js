const { createTestAgent } = require('./helpers/app');
const { withEnv } = require('./helpers/env');
const { prisma } = require('../utils/prisma');
const { hashPassword } = require('../utils/passwordUtils');
const { encodePassword } = require('../utils/passwordEncryption');

const TEST_PASSWORD = 'MySecret1!';
const TEST_EMAIL = 'recaptcha-user@test.com';

async function loginPayload(overrides = {}) {
  return {
    email: TEST_EMAIL,
    password: encodePassword(TEST_PASSWORD),
    ...overrides,
  };
}

function mockRecaptchaFetch(success) {
  return jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ success }),
  });
}

async function seedLoginUser() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  return prisma.user.create({
    data: {
      email: TEST_EMAIL,
      firstName: 'Recaptcha',
      lastName: 'User',
      role: 'EDITOR',
      isActive: true,
      passwordHash,
      createdBy: 'test',
    },
  });
}

describe('POST /api/email-auth/login reCAPTCHA', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await prisma.user.deleteMany();
  });

  describe('production (fail closed)', () => {
    const productionEnv = {
      NODE_ENV: 'production',
      RECAPTCHA_SECRET_KEY: 'test-recaptcha-secret',
    };

    it('rejects login without recaptchaToken', async () => {
      await seedLoginUser();
      await withEnv(productionEnv, async () => {
        const agent = createTestAgent();
        const res = await agent
          .post('/api/email-auth/login')
          .send(await loginPayload());

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('BAD_REQUEST');
        expect(res.body.data).toMatch(/recaptcha/i);
      });
    });

    it('rejects login when Google verification fails', async () => {
      await seedLoginUser();
      global.fetch = mockRecaptchaFetch(false);

      await withEnv(productionEnv, async () => {
        const agent = createTestAgent();
        const res = await agent
          .post('/api/email-auth/login')
          .send(await loginPayload({ recaptchaToken: 'bad-token' }));

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('BAD_REQUEST');
        expect(res.body.data).toMatch(/recaptcha/i);
      });
    });

    it('rejects login when RECAPTCHA_SECRET_KEY is missing', async () => {
      await seedLoginUser();

      await withEnv({ NODE_ENV: 'production' }, async () => {
        const agent = createTestAgent();
        const res = await agent
          .post('/api/email-auth/login')
          .send(await loginPayload({ recaptchaToken: 'any-token' }));

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('BAD_REQUEST');
        expect(res.body.data).toMatch(/recaptcha/i);
      });
    });

    it('allows login with valid recaptcha verification', async () => {
      await seedLoginUser();
      global.fetch = mockRecaptchaFetch(true);

      await withEnv(productionEnv, async () => {
        const agent = createTestAgent();
        const res = await agent
          .post('/api/email-auth/login')
          .send(await loginPayload({ recaptchaToken: 'valid-token' }));

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.email).toBe(TEST_EMAIL);
      });
    });
  });

  describe('development (skip when unconfigured)', () => {
    it('allows login without recaptchaToken when secret is unset', async () => {
      await seedLoginUser();

      await withEnv({ NODE_ENV: 'development' }, async () => {
        const agent = createTestAgent();
        const res = await agent
          .post('/api/email-auth/login')
          .send(await loginPayload());

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
        expect(res.body.data.token).toBeDefined();
      });
    });
  });
});
