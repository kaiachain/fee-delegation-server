const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const metaPath = path.join(__dirname, '.test-meta.json');
  if (!fs.existsSync(metaPath)) {
    return;
  }

  const { dbPath } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  fs.unlinkSync(metaPath);
};
