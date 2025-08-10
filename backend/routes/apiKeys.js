const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { requireEditor } = require('../middleware/auth');

// POST /api/api-keys
router.post('/', requireEditor, async (req, res) => {
  try {
    const { dappId, name } = req.body;

    if (!dappId || !name) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: dappId, name");
    }

    // Check if dapp exists
    const dapp = await prisma.dApp.findUnique({
      where: {
        id: dappId,
      },
    });
    
    if(!dapp) {
      return createResponse(res, "NOT_FOUND", "Dapp not found");
    }

    // Generate a random API key
    const key = `kaia_${ethers.hexlify(ethers.randomBytes(32))}`;

    // Note: API keys and transaction filters can now coexist
    // No validation needed here

    const newApiKey = await prisma.apiKey.create({
      data: {
        key,
        name,
        dappId,
      },
      select: {
        id: true,
        key: true,
        name: true,
        dappId: true,
        createdAt: true
      }
    });

    return createResponse(res, "SUCCESS", newApiKey);
  } catch (error) {
    console.error("Error adding API key:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to add API key");
  }
});

// DELETE /api/api-keys
router.delete('/', requireEditor, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: id");
    }

    await prisma.apiKey.update({
      where: {
        id,
      },
      data: {
        active: false,
      },
    });

    return createResponse(res, "SUCCESS", {message: "API key deactivated"});
  } catch (error) {
    console.error("Error deactivating API key:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to deactivate API key");
  }
});

module.exports = router; 