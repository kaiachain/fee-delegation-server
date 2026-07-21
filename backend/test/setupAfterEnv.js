const fs = require('fs');
const path = require('path');

const metaPath = path.join(__dirname, '.test-meta.json');
const { databaseUrl } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.NETWORK = 'testnet';
