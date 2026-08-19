const { createTestAgent } = require('./helpers/app');
const { withEnv } = require('./helpers/env');

describe('HTTP integration harness', () => {
  it('GET /api/health returns 200 with healthy status', async () => {
    const agent = createTestAgent();
    const res = await agent.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/dapps returns 200 against the isolated test database', async () => {
    const agent = createTestAgent();
    const res = await agent.get('/api/dapps');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/pool without auth returns 401', async () => {
    const agent = createTestAgent();
    const res = await agent.get('/api/pool');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('withEnv can override security-relevant env per test', async () => {
    await withEnv({ NETWORK: 'mainnet' }, async () => {
      expect(process.env.NETWORK).toBe('mainnet');
    });
    expect(process.env.NETWORK).toBe('testnet');
  });
});
