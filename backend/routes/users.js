const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { requireEditorOrSuperAdmin } = require('../middleware/auth');
const { sendAccountCreatedEmail } = require('../utils/emailService');

function isValidEmail(email) {
  return typeof email === 'string' && /.+@.+\..+/.test(email);
}

// GET /api/users
router.get('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true, createdAt: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' }
    });
    return createResponse(res, 'SUCCESS', users);
  } catch (error) {
    console.error('List users error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to list users');
  }
});

// POST /api/users
router.post('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { email, firstName, lastName, role } = req.body || {};
    if (!isValidEmail(email) || !firstName || !lastName) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid input');
    }

    const exists = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (exists) {
      return createResponse(res, 'CONFLICT', 'User already exists');
    }

    // Normalize and validate role against Prisma enum (EDITOR | VIEWER)
    const normalizedRole = (role || 'VIEWER').toString().toUpperCase();
    if (!['EDITOR', 'VIEWER'].includes(normalizedRole)) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid role. Allowed: editor, viewer');
    }

    const created = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        lastName,
        role: normalizedRole,
        createdBy: req.user?.email || 'super-admin',
      }
    });

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      await sendAccountCreatedEmail({ to: created.email, loginUrl: `${baseUrl}/auth/login` });
    } catch (e) {
      console.warn('Account created email not sent:', e?.message || e);
    }

    return createResponse(res, 'SUCCESS', {
      id: created.id,
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt,
      createdBy: created.createdBy
    });
  } catch (error) {
    console.error('Create user error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to create user');
  }
});

// PUT /api/users/:id
router.put('/:id', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, isActive } = req.body || {};
    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (role !== undefined) {
      const normalizedRole = role.toString().toUpperCase();
      if (!['EDITOR', 'VIEWER'].includes(normalizedRole)) {
        return createResponse(res, 'BAD_REQUEST', 'Invalid role. Allowed: editor, viewer');
      }
      data.role = normalizedRole;
    }
    if (isActive !== undefined) data.isActive = isActive;
    const updated = await prisma.user.update({ where: { id }, data });
    return createResponse(res, 'SUCCESS', { id: updated.id });
  } catch (error) {
    console.error('Update user error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to update user');
  }
});

// DELETE /api/users/:id (soft delete)
router.delete('/:id', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return createResponse(res, 'SUCCESS', { id });
  } catch (error) {
    console.error('Deactivate user error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to deactivate user');
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) {
      return createResponse(res, 'NOT_FOUND', 'User not found');
    }
    const token = await prisma.passwordResetToken.create({
      data: {
        token: cryptoRandomToken(),
        userId: id,
        expiresAt: new Date(Date.now() + (Number(process.env.PASSWORD_RESET_EXPIRATION || 60) * 60 * 1000)),
      }
    });
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token.token)}`;
      await sendAccountCreatedEmail({ to: user.email, loginUrl: resetUrl });
    } catch (e) {
      console.warn('Manual reset email not sent:', e?.message || e);
    }
    return createResponse(res, 'SUCCESS', {});
  } catch (error) {
    console.error('Reset user password error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to trigger reset');
  }
});

function cryptoRandomToken() {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}

module.exports = router;


