const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { requireSuperAdmin } = require('../middleware/auth');
const { loadRpcUrls, pingUrl } = require('../utils/rpcProvider');

router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const urls = await prisma.rpcUrl.findMany({ orderBy: { createdAt: 'asc' } });
    return createResponse(res, 'SUCCESS', urls);
  } catch (error) {
    console.error('List RPC URLs error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to list RPC URLs');
  }
});

router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return createResponse(res, 'BAD_REQUEST', 'URL is required');
    }

    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return createResponse(res, 'BAD_REQUEST', 'URL must start with http:// or https://');
    }

    const exists = await prisma.rpcUrl.findFirst({ where: { url: trimmed } });
    if (exists) {
      return createResponse(res, 'CONFLICT', 'This RPC URL already exists');
    }

    const created = await prisma.rpcUrl.create({
      data: { url: trimmed },
    });

    await loadRpcUrls();

    return createResponse(res, 'SUCCESS', created);
  } catch (error) {
    console.error('Create RPC URL error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to create RPC URL');
  }
});

router.put('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body || {};

    if (active === undefined) {
      return createResponse(res, 'BAD_REQUEST', 'No fields to update');
    }

    const updated = await prisma.rpcUrl.update({
      where: { id },
      data: { active },
    });

    await loadRpcUrls();

    return createResponse(res, 'SUCCESS', updated);
  } catch (error) {
    console.error('Update RPC URL error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to update RPC URL');
  }
});

router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.rpcUrl.delete({ where: { id } });
    await loadRpcUrls();

    return createResponse(res, 'SUCCESS', { id });
  } catch (error) {
    console.error('Delete RPC URL error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to delete RPC URL');
  }
});

router.post('/:id/ping', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rpcUrl = await prisma.rpcUrl.findUnique({ where: { id } });
    if (!rpcUrl) {
      return createResponse(res, 'NOT_FOUND', 'RPC URL not found');
    }

    const start = Date.now();
    const healthy = await pingUrl(rpcUrl.url);
    const latency = Date.now() - start;

    return createResponse(res, 'SUCCESS', { healthy, latencyMs: latency });
  } catch (error) {
    console.error('Ping RPC URL error:', error);
    return createResponse(res, 'INTERNAL_ERROR', 'Failed to ping RPC URL');
  }
});

module.exports = router;
