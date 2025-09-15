const express = require('express');
const router = express.Router();
const { createResponse, logError, getCleanErrorMessage } = require('../utils/apiUtils');
const { pickProviderFromPool } = require('../utils/rpcProvider');
const { requireEditorOrSuperAdmin } = require('../middleware/auth');

// GET /api/pool
router.get('/', requireEditorOrSuperAdmin, async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  try {
    const balance = await pickProviderFromPool().getBalance(process.env.ACCOUNT_ADDRESS || "", "latest");
    return createResponse(res, "SUCCESS", balance.toString(), requestId);
  } catch (error) {
    logError(error, requestId, 'Pool balance fetch failed');
    return createResponse(res, "INTERNAL_ERROR", `Failed to fetch pool: ${getCleanErrorMessage(error)}`, requestId);
  }
});

module.exports = router; 