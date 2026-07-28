const { createTestAgent } = require('./helpers/app');
const { prisma } = require('../utils/prisma');
const { signEmailJwt } = require('../utils/passwordUtils');

async function createTestUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: 'admin@test.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      createdBy: 'test',
      ...overrides,
    },
  });
}

function superAdminAuthHeader(user) {
  const role = (user.role || 'SUPER_ADMIN').toString().toLowerCase();
  const token = signEmailJwt({ sub: user.id, email: user.email, role });
  return { Authorization: `Bearer ${token}` };
}

describe('RPC URL SSRF validation (unit)', () => {
  const { getRpcUrlValidationError } = require('../utils/rpcUrlValidation');

  it('accepts public https RPC URLs', () => {
    expect(getRpcUrlValidationError('https://public-rpc.example.com')).toBeNull();
    expect(getRpcUrlValidationError('https://rpc.kaia.io/v1/mainnet')).toBeNull();
  });

  it('accepts public http RPC URLs', () => {
    expect(getRpcUrlValidationError('http://public-rpc.example.com')).toBeNull();
  });

  it('rejects non-http(s) schemes', () => {
    expect(getRpcUrlValidationError('file:///etc/passwd')).toMatch(/http/i);
    expect(getRpcUrlValidationError('ftp://example.com/rpc')).toMatch(/http/i);
    expect(getRpcUrlValidationError('gopher://127.0.0.1/')).toMatch(/http/i);
  });

  it('rejects loopback hostnames and addresses', () => {
    expect(getRpcUrlValidationError('http://localhost/rpc')).toMatch(/private|loopback|not allowed/i);
    expect(getRpcUrlValidationError('http://127.0.0.1:8545')).toMatch(/private|loopback|not allowed/i);
    expect(getRpcUrlValidationError('http://[::1]:8545')).toMatch(/private|loopback|not allowed/i);
  });

  it('rejects IPv4-mapped IPv6 loopback forms', () => {
    expect(getRpcUrlValidationError('http://[::ffff:127.0.0.1]/')).toMatch(/private|loopback|not allowed/i);
    expect(getRpcUrlValidationError('http://[::ffff:7f00:1]/')).toMatch(/private|loopback|not allowed/i);
  });

  it('rejects private IPv4 ranges', () => {
    expect(getRpcUrlValidationError('https://10.0.0.1/rpc')).toMatch(/private|loopback|not allowed/i);
    expect(getRpcUrlValidationError('https://172.16.0.1/rpc')).toMatch(/private|loopback|not allowed/i);
    expect(getRpcUrlValidationError('https://192.168.1.1/rpc')).toMatch(/private|loopback|not allowed/i);
  });

  it('rejects link-local and cloud metadata destinations', () => {
    expect(getRpcUrlValidationError('http://169.254.169.254/latest/meta-data/')).toMatch(/private|loopback|metadata|not allowed/i);
    expect(getRpcUrlValidationError('http://metadata.google.internal/computeMetadata/v1/')).toMatch(/private|loopback|metadata|not allowed/i);
  });

  it('rejects malformed URLs', () => {
    expect(getRpcUrlValidationError('not-a-url')).toBeTruthy();
    expect(getRpcUrlValidationError('')).toBeTruthy();
  });
});

describe('RPC URL outbound safety (resolve-time + redirects)', () => {
  const {
    assertRpcUrlSafeForOutbound,
    filterSafeRpcUrls,
  } = require('../utils/rpcUrlValidation');

  it('assertRpcUrlSafeForOutbound rejects hostnames that resolve to loopback', async () => {
    const lookup = jest.fn(async () => [{ address: '127.0.0.1', family: 4 }]);
    const err = await assertRpcUrlSafeForOutbound('http://127.0.0.1.nip.io/rpc', { lookup });
    expect(err).toMatch(/private|loopback|not allowed/i);
    expect(lookup).toHaveBeenCalled();
  });

  it('assertRpcUrlSafeForOutbound accepts hostnames that resolve to public IPs', async () => {
    const lookup = jest.fn(async () => [{ address: '203.0.113.10', family: 4 }]);
    const err = await assertRpcUrlSafeForOutbound('https://public-rpc.example.com', { lookup });
    expect(err).toBeNull();
  });

  it('filterSafeRpcUrls drops sync-unsafe URLs and keeps public ones', async () => {
    const lookup = jest.fn(async () => [{ address: '203.0.113.10', family: 4 }]);
    const filtered = await filterSafeRpcUrls(
      [
        'https://public-rpc.example.com',
        'http://127.0.0.1:8545',
        'http://[::ffff:7f00:1]/',
      ],
      { lookup }
    );
    expect(filtered).toEqual(['https://public-rpc.example.com']);
  });

  it('filterSafeRpcUrls drops URLs whose DNS resolves to private IPs', async () => {
    const lookup = jest.fn(async (hostname) => {
      if (hostname === 'evil.example.com') {
        return [{ address: '169.254.169.254', family: 4 }];
      }
      return [{ address: '203.0.113.10', family: 4 }];
    });
    const filtered = await filterSafeRpcUrls(
      ['https://evil.example.com', 'https://ok.example.com'],
      { lookup }
    );
    expect(filtered).toEqual(['https://ok.example.com']);
  });
});

describe('pingUrl redirect policy', () => {
  const { pingUrl } = require('../utils/rpcProvider');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('treats HTTP redirects as unhealthy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: { get: () => 'http://169.254.169.254/' },
      json: async () => ({}),
    });

    const healthy = await pingUrl('https://203.0.113.10/v1');
    expect(healthy).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://203.0.113.10/v1',
      expect.objectContaining({ redirect: 'manual' })
    );
  });
});

describe('RPC URL SSRF validation (HTTP, Super Admin)', () => {
  let superAdmin;

  beforeEach(async () => {
    await prisma.rpcUrl.deleteMany();
    await prisma.user.deleteMany();
    superAdmin = await createTestUser();
  });

  it('POST /api/rpc-urls rejects private targets on create', async () => {
    const agent = createTestAgent();
    const res = await agent
      .post('/api/rpc-urls')
      .set(superAdminAuthHeader(superAdmin))
      .send({ url: 'http://127.0.0.1:8545' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_REQUEST');
    expect(res.body.data).toMatch(/private|loopback|not allowed/i);
  });

  it('POST /api/rpc-urls rejects non-http(s) URLs on create', async () => {
    const agent = createTestAgent();
    const res = await agent
      .post('/api/rpc-urls')
      .set(superAdminAuthHeader(superAdmin))
      .send({ url: 'file:///etc/passwd' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_REQUEST');
    expect(res.body.data).toMatch(/http/i);
  });

  it('POST /api/rpc-urls accepts public https RPC URLs on create', async () => {
    const agent = createTestAgent();
    const res = await agent
      .post('/api/rpc-urls')
      .set(superAdminAuthHeader(superAdmin))
      .send({ url: 'https://example.com/rpc' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data.url).toBe('https://example.com/rpc');
  });

  it('POST /api/rpc-urls/:id/ping rejects private targets stored in DB', async () => {
    const stored = await prisma.rpcUrl.create({
      data: { url: 'http://192.168.0.10:8545' },
    });

    const agent = createTestAgent();
    const res = await agent
      .post(`/api/rpc-urls/${stored.id}/ping`)
      .set(superAdminAuthHeader(superAdmin));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_REQUEST');
    expect(res.body.data).toMatch(/private|loopback|not allowed/i);
  });

  it('POST /api/rpc-urls/:id/ping allows public https URLs', async () => {
    const stored = await prisma.rpcUrl.create({
      data: { url: 'https://example.com/rpc' },
    });

    const agent = createTestAgent();
    const res = await agent
      .post(`/api/rpc-urls/${stored.id}/ping`)
      .set(superAdminAuthHeader(superAdmin));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(typeof res.body.data.healthy).toBe('boolean');
    expect(typeof res.body.data.latencyMs).toBe('number');
  });
});
