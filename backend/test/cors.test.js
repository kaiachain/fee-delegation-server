jest.mock('../routes/balance', () => {
  const express = require('express');
  const passthrough = express.Router();
  passthrough.use((req, res, next) => next());
  return {
    balanceRouter: passthrough,
    balanceV2Router: passthrough,
  };
});

const express = require('express');
const request = require('supertest');
const { mountApiRoutes } = require('../createApiApp');

function createAppWithStubbedV2BalanceRoute() {
  const app = express();
  mountApiRoutes(app);
  app.use('/api/v2/balance', (req, res) => res.status(200).end());
  return app;
}

describe('/api/v2/balance CORS middleware', () => {
  it('OPTIONS sets Content-Type application/json before the route handler', async () => {
    const res = await request(createAppWithStubbedV2BalanceRoute()).options('/api/v2/balance');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('GET sets Content-Type application/json before the route handler', async () => {
    const res = await request(createAppWithStubbedV2BalanceRoute()).get('/api/v2/balance');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
