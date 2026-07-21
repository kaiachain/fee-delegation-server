const { createTestAgent } = require('./helpers/app');
const { prisma } = require('../utils/prisma');
const { signEmailJwt } = require('../utils/passwordUtils');

async function createTestUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: 'editor@test.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'EDITOR',
      isActive: true,
      createdBy: 'test',
      ...overrides,
    },
  });
}

function bearerTokenFor(user, jwtRoleOverride) {
  const role = jwtRoleOverride ?? (user.role || 'EDITOR').toString().toLowerCase();
  return signEmailJwt({ sub: user.id, email: user.email, role });
}

describe('Email JWT DB authorization', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('rejects inactive user JWT on editor-gated admin API', async () => {
    const user = await createTestUser({ isActive: false, role: 'EDITOR' });
    const token = bearerTokenFor(user, 'editor');

    const agent = createTestAgent();
    const res = await agent.get('/api/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('rejects demoted user when JWT still claims editor role', async () => {
    const user = await createTestUser({ role: 'VIEWER' });
    const token = bearerTokenFor(user, 'editor');

    const agent = createTestAgent();
    const res = await agent.get('/api/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('allows active correctly-roled editor on editor-gated admin API', async () => {
    const user = await createTestUser({ role: 'EDITOR' });
    const token = bearerTokenFor(user);

    const agent = createTestAgent();
    const res = await agent.get('/api/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
