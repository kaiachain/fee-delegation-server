const request = require('supertest');
const { createApiApp } = require('../../createApiApp');

/**
 * Returns a supertest agent bound to a fresh Express API app instance.
 * DATABASE_URL must already point at the isolated test database (see globalSetup).
 */
function createTestAgent() {
  const app = createApiApp();
  return request(app);
}

module.exports = { createTestAgent };
