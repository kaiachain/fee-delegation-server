const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { createResponse, checkDappHasApiKeys, checkSenderExistsForNoApiKeyDapps, checkSenderExistsForApiKeyDapps } = require('../utils/apiUtils');
const { requireEditorOrSuperAdmin } = require('../middleware/auth');

// POST /api/senders/check
router.post('/check', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || !ethers.isAddress(address)) {
      return createResponse(res, "BAD_REQUEST", "Invalid contract address");
    }

    // Check if sender exists (only active senders)
    const existingContract = await prisma.sender.findFirst({
      where: {
        address: address.toLowerCase(),
        active: true
      }
    });

    return createResponse(res, "SUCCESS", !!existingContract);
  } catch (error) {
    console.error("Error checking contract:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to check contract");
  }
});

// POST /api/senders
router.post('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';

    // Only super admin can modify senders
    if (!isSuperAdmin) {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can modify sender addresses");
    }

    const { dappId, address } = req.body;

    if (!dappId || !address) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: dappId, address");
    }

    if (ethers.isAddress(address) === false) {
      return createResponse(res, "BAD_REQUEST", "Invalid address");
    }

    // Check if the DApp has API keys
    const dappHasApiKeys = await checkDappHasApiKeys(dappId);
    
    if (dappHasApiKeys) {
      // For DApps with API keys: check if sender exists in any DApp with API keys
      const existingSender = await checkSenderExistsForApiKeyDapps(address);
      if (existingSender) {
        return createResponse(res, "BAD_REQUEST", "Sender already exists in a DApp with API keys");
      }
    } else {
      // For DApps without API keys: check if sender exists in any DApp without API keys
      const existingSender = await checkSenderExistsForNoApiKeyDapps(address);
      if (existingSender) {
        return createResponse(res, "BAD_REQUEST", "Sender already exists in a DApp without API keys");
      }
    }

    const newSender = await prisma.sender.create({
      data: {
        address: address.toLowerCase(),
        dappId,
        active: true,
      },
    });

    return createResponse(res, "SUCCESS", newSender);
  } catch (error) {
    console.error("Error adding sender:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to add sender");
  }
});

// DELETE /api/senders
router.delete('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';

    // Only super admin can modify senders
    if (!isSuperAdmin) {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can modify sender addresses");
    }

    const { id } = req.body;

    if (!id) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: id");
    }

    const sender = await prisma.sender.update({
      where: {
        id,
      },
      data: {
        active: false,
      },
    });

    return createResponse(res, "SUCCESS", sender);
  } catch (error) {
    console.error("Error deactivating sender:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to deactivate sender");
  }
});

module.exports = router; 