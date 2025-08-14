const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { hashPassword, comparePassword, signEmailJwt } = require('../utils/passwordUtils');
const { sendPasswordResetEmail } = require('../utils/emailService');
const { rateLimit } = require('../middleware/rateLimiting');
const { validateEmail, validatePassword } = require('../middleware/validation');

function isValidEmail(email) {
  return typeof email === 'string' && /.+@.+\..+/.test(email);
}

// POST /api/email-auth/login
router.post('/login', rateLimit({ name: 'login', max: 10, windowMs: 60_000 }), validateEmail, validatePassword, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || !password) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid email or password');
    }

    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), isActive: true } });
    if (!user || !user.passwordHash) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid credentials');
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid credentials');
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Normalize role to lowercase strings used by FE/middleware
    const normalizedRole = (user.role || 'EDITOR').toString().toLowerCase();
    const token = signEmailJwt({
      sub: user.id,
      email: user.email,
      role: normalizedRole,
    }, '2h');

    return createResponse(res, 'SUCCESS', { token, role: normalizedRole, email: user.email });
  } catch (error) {
    console.error('Email login error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to login');
  }
});

// POST /api/email-auth/reset-password (request reset)
router.post('/reset-password', rateLimit({ name: 'reset', max: 5, windowMs: 60_000 }), validateEmail, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!isValidEmail(email)) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid email');
    }

    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), isActive: true } });
    if (!user) {
      // Do not leak existence
      return createResponse(res, 'SUCCESS', {});
    }

    const token = await prisma.passwordResetToken.create({
      data: {
        token: cryptoRandomToken(),
        userId: user.id,
        expiresAt: new Date(Date.now() + (Number(process.env.PASSWORD_RESET_EXPIRATION || 60) * 60 * 1000)),
      }
    });

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token.token)}`;
      await sendPasswordResetEmail({ to: user.email, resetUrl });
    } catch (e) {
      console.warn('Password reset email not sent:', e?.message || e);
    }

    return createResponse(res, 'SUCCESS', {});
  } catch (error) {
    console.error('Reset password request error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to request reset');
  }
});

// POST /api/email-auth/set-password (complete reset)
router.post('/set-password', rateLimit({ name: 'setpw', max: 5, windowMs: 60_000 }), validatePassword, async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid input');
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used || record.expiresAt <= new Date()) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid or expired token plese trigger reset password again');
    }

    const hash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: hash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    ]);

    return createResponse(res, 'SUCCESS', {});
  } catch (error) {
    console.error('Set password error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to set password');
  }
});

// POST /api/email-auth/change-password (authenticated via email JWT)
router.post('/change-password', rateLimit({ name: 'changepw', max: 10, windowMs: 60_000 }), validatePassword, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const { oldPassword, newPassword } = req.body || {};

    const payload = require('../utils/passwordUtils').verifyEmailJwt(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.passwordHash) {
      return createResponse(res, 'UNAUTHORIZED', 'Invalid session');
    }

    const ok = await comparePassword(oldPassword, user.passwordHash);
    if (!ok) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid current password');
    }

    const hash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    return createResponse(res, 'SUCCESS', {});
  } catch (error) {
    console.error('Change password error:', error);
    return createResponse(res, 'UNAUTHORIZED', 'Unauthorized');
  }
});


function cryptoRandomToken() {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}

module.exports = router;


