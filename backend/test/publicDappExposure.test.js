const { createTestAgent } = require('./helpers/app');
const { prisma } = require('../utils/prisma');

/**
 * GET /api/dapps is intentionally public: it backs the public DApp listing and
 * exposes name / url / balance / usage. This suite pins what it must NEVER
 * return, so swapping the handler's `select` for an `include` fails loudly
 * instead of silently publishing API keys.
 */
describe('GET /api/dapps public exposure', () => {
  const SECRET_KEY = 'kaia_0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  const SENDER_ADDRESS = '0x1111111111111111111111111111111111111111';
  const CONTRACT_ADDRESS = '0x2222222222222222222222222222222222222222';
  const ALERT_EMAIL = 'ops@example.com';

  beforeEach(async () => {
    await prisma.dApp.deleteMany();
    await prisma.dApp.create({
      data: {
        name: 'Public Test DApp',
        url: 'https://dapp.example.com',
        balance: '1000000000000000000',
        totalUsed: '5',
        apiKeys: { create: [{ key: SECRET_KEY, name: 'primary' }] },
        contracts: { create: [{ address: CONTRACT_ADDRESS }] },
        senders: { create: [{ address: SENDER_ADDRESS }] },
        emailAlerts: {
          create: [{ email: ALERT_EMAIL, balanceThreshold: '1', isActive: true }],
        },
        contractUsages: {
          create: [{ contractAddress: CONTRACT_ADDRESS, totalUsed: '5' }],
        },
      },
    });
  });

  it('returns the intended public fields', async () => {
    const res = await createTestAgent().get('/api/dapps');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);

    const dapp = res.body.data.find((d) => d.name === 'Public Test DApp');
    expect(dapp).toBeDefined();
    expect(dapp.url).toBe('https://dapp.example.com');
    expect(dapp.balance).toBe('1000000000000000000');
    expect(Object.keys(dapp).sort()).toEqual(
      ['balance', 'createdAt', 'id', 'name', 'totalUsed', 'url'].sort()
    );
  });

  it('never exposes API keys, senders, or alert emails', async () => {
    for (const url of ['/api/dapps', '/api/dapps?usageSummary=true']) {
      const res = await createTestAgent().get(url);
      expect(res.status).toBe(200);

      // Scan the serialized body: catches nesting under any key name.
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(SECRET_KEY);
      expect(body).not.toContain('kaia_');
      expect(body).not.toContain('apiKeys');
      expect(body).not.toContain(SENDER_ADDRESS);
      expect(body).not.toContain(ALERT_EMAIL);
    }
  });

  it('limits usageSummary to contract usage figures', async () => {
    const res = await createTestAgent().get('/api/dapps?usageSummary=true');
    const dapp = res.body.data.find((d) => d.name === 'Public Test DApp');

    expect(dapp.contractUsages).toHaveLength(1);
    expect(Object.keys(dapp.contractUsages[0]).sort()).toEqual(
      ['contractAddress', 'totalUsed', 'updatedAt'].sort()
    );
  });

  it('requires auth for the management view that does expose keys', async () => {
    const res = await createTestAgent().get('/api/dapps/management');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(SECRET_KEY);
  });
});
