const { createTestAgent } = require('./helpers/app');
const { prisma } = require('../utils/prisma');
const { signEmailJwt } = require('../utils/passwordUtils');

function editorAuthHeader() {
  const token = signEmailJwt({ email: 'editor@test.com', role: 'editor' });
  return { Authorization: `Bearer ${token}` };
}

describe('API key secret hygiene', () => {
  let dappId;

  beforeEach(async () => {
    await prisma.apiKey.deleteMany();
    await prisma.dApp.deleteMany();

    const dapp = await prisma.dApp.create({
      data: {
        name: `test-dapp-${Date.now()}`,
        url: 'https://example.com',
        balance: '1000000000000000000',
      },
    });
    dappId = dapp.id;
  });

  it('POST /api/api-keys returns the full secret once on create', async () => {
    const agent = createTestAgent();
    const res = await agent
      .post('/api/api-keys')
      .set(editorAuthHeader())
      .send({ dappId, name: 'integration-key' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data.key).toMatch(/^kaia_0x[0-9a-f]{64}$/);
    expect(res.body.data.key.endsWith('...')).toBe(false);
  });

  it('GET /api/dapps/management redacts API key secrets', async () => {
    const agent = createTestAgent();
    const createRes = await agent
      .post('/api/api-keys')
      .set(editorAuthHeader())
      .send({ dappId, name: 'list-redaction-key' });

    const fullSecret = createRes.body.data.key;

    const listRes = await agent
      .get('/api/dapps/management')
      .set(editorAuthHeader());

    expect(listRes.status).toBe(200);
    const dapp = listRes.body.data.find((entry) => entry.id === dappId);
    expect(dapp).toBeDefined();

    const listedKey = dapp.apiKeys.find((key) => key.name === 'list-redaction-key');
    expect(listedKey).toBeDefined();
    expect(listedKey.key).not.toBe(fullSecret);
    expect(listedKey.key.endsWith('...')).toBe(true);
    expect(fullSecret.startsWith(listedKey.key.slice(0, -3))).toBe(true);
  });

  it('existing API keys still authenticate balance reads', async () => {
    const agent = createTestAgent();
    const createRes = await agent
      .post('/api/api-keys')
      .set(editorAuthHeader())
      .send({ dappId, name: 'auth-key' });

    const fullSecret = createRes.body.data.key;

    const balanceRes = await agent
      .get('/api/balance')
      .set({ Authorization: `Bearer ${fullSecret}` });

    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.status).toBe(true);
    expect(typeof balanceRes.body.data).toBe('boolean');
  });
});
