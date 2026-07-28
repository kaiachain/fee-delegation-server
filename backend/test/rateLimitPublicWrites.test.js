const { createTestAgent } = require('./helpers/app');
const { withEnv } = require('./helpers/env');

const LOW_IP_MAX = '3';
const LOW_API_KEY_MAX = '2';
const WINDOW_MS = '60000';

async function burstRequest(agent, method, path, count, opts = {}) {
  const responses = [];
  for (let i = 0; i < count; i++) {
    let req = agent[method](path);
    if (method === 'post') req = req.send(opts.body ?? {});
    if (opts.ip) req = req.set('X-Forwarded-For', opts.ip);
    if (opts.authorization) req = req.set('Authorization', opts.authorization);
    responses.push(await req);
  }
  return responses;
}

async function burstPost(agent, path, count, opts = {}) {
  return burstRequest(agent, 'post', path, count, opts);
}

async function burstGet(agent, path, count, opts = {}) {
  return burstRequest(agent, 'get', path, count, opts);
}

describe('public write rate limits', () => {
  const rateLimitEnv = {
    FEE_DELEGATION_RATE_LIMIT_IP_MAX: LOW_IP_MAX,
    FEE_DELEGATION_RATE_LIMIT_API_KEY_MAX: LOW_API_KEY_MAX,
    FEE_DELEGATION_RATE_LIMIT_WINDOW_MS: WINDOW_MS,
  };

  it('POST /api/signAsFeePayer returns 429 with Retry-After when IP burst exceeds limit', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const responses = await burstPost(agent, '/api/signAsFeePayer', Number(LOW_IP_MAX) + 1, {
        ip: '203.0.113.10',
      });

      const limited = responses.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0].body.error).toBe('RATE_LIMITED');
      expect(limited[0].headers['retry-after']).toBeDefined();
    });
  });

  it('POST /api/gasFreeSwapKaia returns 429 with Retry-After when IP burst exceeds limit', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const responses = await burstPost(agent, '/api/gasFreeSwapKaia', Number(LOW_IP_MAX) + 1, {
        ip: '203.0.113.11',
      });

      const limited = responses.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0].body.error).toBe('RATE_LIMITED');
      expect(limited[0].headers['retry-after']).toBeDefined();
    });
  });

  it('limits apply per IP independently on signAsFeePayer', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const burstCount = Number(LOW_IP_MAX) + 1;

      const ipA = await burstPost(agent, '/api/signAsFeePayer', burstCount, { ip: '203.0.113.20' });
      const ipB = await burstPost(agent, '/api/signAsFeePayer', 1, { ip: '203.0.113.21' });

      expect(ipA.some((r) => r.status === 429)).toBe(true);
      expect(ipB[0].status).not.toBe(429);
    });
  });

  it('limits apply per API key when Bearer token present on signAsFeePayer', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const burstCount = Number(LOW_API_KEY_MAX) + 1;
      const auth = 'Bearer test-api-key-for-rate-limit';

      const responses = await burstPost(agent, '/api/signAsFeePayer', burstCount, {
        ip: '203.0.113.30',
        authorization: auth,
      });

      const limited = responses.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0].body.error).toBe('RATE_LIMITED');
    });
  });

  it('limits apply per API key when Bearer token present on gasFreeSwapKaia', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const burstCount = Number(LOW_API_KEY_MAX) + 1;
      const auth = 'Bearer swap-api-key-for-rate-limit';

      const responses = await burstPost(agent, '/api/gasFreeSwapKaia', burstCount, {
        ip: '203.0.113.31',
        authorization: auth,
      });

      const limited = responses.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0].body.error).toBe('RATE_LIMITED');
    });
  });

  it('GET /api/balance returns 429 with Retry-After when IP burst exceeds limit', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const responses = await burstGet(agent, '/api/balance', Number(LOW_IP_MAX) + 1, {
        ip: '203.0.113.40',
      });

      const limited = responses.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0].body.error).toBe('RATE_LIMITED');
      expect(limited[0].headers['retry-after']).toBeDefined();
    });
  });

  it('GET /api/v2/balance returns 429 with Retry-After when IP burst exceeds limit', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const responses = await burstGet(agent, '/api/v2/balance', Number(LOW_IP_MAX) + 1, {
        ip: '203.0.113.41',
      });

      const limited = responses.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0].body.error).toBe('RATE_LIMITED');
      expect(limited[0].headers['retry-after']).toBeDefined();
    });
  });

  it('limits apply per API key when Bearer token present on balance', async () => {
    await withEnv(rateLimitEnv, async () => {
      const agent = createTestAgent();
      const burstCount = Number(LOW_API_KEY_MAX) + 1;
      const auth = 'Bearer balance-api-key-for-rate-limit';

      const responses = await burstGet(agent, '/api/balance', burstCount, {
        ip: '203.0.113.42',
        authorization: auth,
      });

      const limited = responses.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0].body.error).toBe('RATE_LIMITED');
    });
  });
});
