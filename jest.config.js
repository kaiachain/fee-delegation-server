/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/backend/test/**/*.test.js'],
  globalSetup: '<rootDir>/backend/test/globalSetup.js',
  globalTeardown: '<rootDir>/backend/test/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/backend/test/setupAfterEnv.js'],
  // One worker avoids SQLite file contention and keeps env predictable.
  maxWorkers: 1,
};
