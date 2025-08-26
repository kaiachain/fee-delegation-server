const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
const EMAIL_AUTH_JWT_SECRET = process.env.EMAIL_AUTH_JWT_SECRET || 'change-me-in-env';

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function signEmailJwt(payload, expiresIn = '2h') {
  return jwt.sign(payload, EMAIL_AUTH_JWT_SECRET, { expiresIn });
}

function verifyEmailJwt(token) {
  return jwt.verify(token, EMAIL_AUTH_JWT_SECRET);
}

module.exports = {
  hashPassword,
  comparePassword,
  signEmailJwt,
  verifyEmailJwt,
};


