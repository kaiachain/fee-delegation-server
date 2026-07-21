const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = async () => {
  const dbPath = path.join(os.tmpdir(), `fee-delegation-http-test-${process.pid}.db`);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const databaseUrl = `file:${dbPath}`;
  const metaPath = path.join(__dirname, '.test-meta.json');

  fs.writeFileSync(metaPath, JSON.stringify({ databaseUrl, dbPath }));

  const repoRoot = path.join(__dirname, '../..');
  execSync('npx prisma db push --schema=./backend/prisma/schema.prisma --skip-generate', {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
};
