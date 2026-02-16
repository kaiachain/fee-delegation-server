const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { requireEditorOrSuperAdmin, requireSuperAdmin } = require('../middleware/auth');
const { sendAccountCreatedEmail, sendAccountCreatedWithPasswordSetupEmail } = require('../utils/emailService');

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
router.post('/', requireSuperAdmin, async (req, res) => {
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
      // Create password reset token with 7-day expiration for new user setup
      const token = await prisma.passwordResetToken.create({
        data: {
          token: cryptoRandomToken(),
          userId: created.id,
          expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days for user creation
        }
      });

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token.token)}`;
      await sendAccountCreatedWithPasswordSetupEmail({ to: created.email, resetUrl });
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
router.put('/:id', requireSuperAdmin, async (req, res) => {
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

// DELETE /api/users/:id (soft delete by default, hard delete with ?hard=true)
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;
    
    if (hard === 'true') {
      // Hard delete: physically delete the user (cascades remove DApp access)
      await prisma.user.delete({ where: { id } });
      return createResponse(res, 'SUCCESS', { id, deleted: 'hard' });
    } else {
      // Soft delete: set isActive=false and remove all DApp access
      await prisma.$transaction(async (tx) => {
        // Remove all DApp access for this user
        await tx.userDappAccess.deleteMany({ where: { userId: id } });
        
        // Set user as inactive
        await tx.user.update({ where: { id }, data: { isActive: false } });
      });
      
      return createResponse(res, 'SUCCESS', { id, deleted: 'soft' });
    }
  } catch (error) {
    console.error('Delete user error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to delete user');
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

// GET /api/users/validate/:email - Validate if user exists and is active
router.get('/validate/:email', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!isValidEmail(email)) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid email format');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true }
    });

    if (!user || user.role === "VIEWER") {
      return createResponse(res, 'NOT_FOUND', 'No user found with this email address. Please make sure the user has been created in the system.');
    }

    if (!user.isActive) {
      return createResponse(res, 'BAD_REQUEST', 'This user account is inactive and cannot be assigned to DApps.');
    }

    return createResponse(res, 'SUCCESS', user);
  } catch (error) {
    console.error('Validate user error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to validate user');
  }
});

function cryptoRandomToken() {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}

module.exports = router;


