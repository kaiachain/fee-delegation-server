# HTTP integration tests

Express API routes are exercised with [supertest](https://github.com/ladjs/supertest) against an isolated SQLite database. This is the primary seam for security-hardening regression tests (see parent PRD #3).

## Running

```bash
npm test
```

Requires `prisma generate` (run once after clone or schema change):

```bash
npm run db:generate
```

## Adding a test case

1. Create `backend/test/<feature>.test.js` (or add to an existing file grouped by behavior).
2. Import helpers:

   ```javascript
   const { createTestAgent } = require('./helpers/app');
   const { withEnv } = require('./helpers/env');
   ```

3. Issue HTTP requests and assert **status + JSON body** (external behavior), not private helpers:

   ```javascript
   it('rejects unauthenticated admin list', async () => {
     const agent = createTestAgent();
     const res = await agent.get('/api/users');
     expect(res.status).toBe(401);
     expect(res.body.error).toBe('UNAUTHORIZED');
   });
   ```

4. Override env vars that gate security behavior for a single test or block:

   ```javascript
   await withEnv({ NETWORK: 'mainnet', EMAIL_AUTH_JWT_SECRET: 'test-secret' }, async () => {
     const res = await createTestAgent().get('/api/...');
     // assertions
   });
   ```

5. Seed data through Prisma when a route needs DB state:

   ```javascript
   const { prisma } = require('../utils/prisma');

   beforeEach(async () => {
     await prisma.user.deleteMany();
     await prisma.user.create({ data: { /* ... */ } });
   });
   ```

   Prefer minimal fixtures scoped to the test file.

## Harness layout

| File | Role |
|------|------|
| `helpers/app.js` | `createTestAgent()` — supertest bound to `createApiApp()` |
| `helpers/env.js` | `withEnv(overrides, fn)` — temporary `process.env` |
| `globalSetup.js` | Creates temp SQLite DB + `prisma db push` |
| `setupAfterEnv.js` | Sets `DATABASE_URL`, `NODE_ENV=test`, default `NETWORK=testnet` |

Production boot (`server.js`) and tests share the same route wiring via `backend/createApiApp.js`. Tests do **not** start Next.js or call `listen()`; supertest invokes the Express app in-process.

## Notes for later tickets

- **Startup / config gates** that run before Express mounts may need a separate unit seam; most behaviors are still assertable via HTTP once the process is up.
- If a test changes env vars read at **module load** time (e.g. JWT secret constants), clear the relevant `require.cache` entries or split config behind lazy getters — document any such pattern in the test file.
- Keep tests in `backend/test/`; Hardhat tests and `examples/` scripts are not the primary security seam.
