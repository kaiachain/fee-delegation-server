const express = require('express');
const router = express.Router();
const { createResponse } = require('../utils/apiUtils');
const { pickProviderFromPool } = require('../utils/rpcProvider');
const { formattedBalance } = require('../utils/apiUtils');
const { requireEditor } = require('../middleware/auth');

// GET /api/pool
router.get('/', requireEditor, async (req, res) => {
  try {
    const balance = await pickProviderFromPool().getBalance(process.env.ACCOUNT_ADDRESS || "", "latest");
    return createResponse(res, "SUCCESS", formattedBalance(balance.toString()));
  } catch (error) {
    console.error("Error fetching pool:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to fetch pool");
  }
});

module.exports = router; 