const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { createResponse, checkDappHasApiKeys, checkContractExistsForNoApiKeyDapps, checkContractExistsForApiKeyDapps } = require('../utils/apiUtils');
const { requireEditor } = require('../middleware/auth');

// POST /api/contracts/check
router.post('/check', requireEditor, async (req, res) => {
  try {
    const { address, hasSwap, swapAddress } = req.body;

    if (!address || !ethers.isAddress(address)) {
      return createResponse(res, "BAD_REQUEST", "Invalid contract address");
    }

    // Check if contract exists with the same address and swap configuration (only active contracts)
    const existingContract = await prisma.contract.findFirst({
      where: {
        address: address.toLowerCase(),
        hasSwap: hasSwap || false,
        swapAddress: hasSwap ? swapAddress?.toLowerCase() : null,
        active: true
      }
    });

    return createResponse(res, "SUCCESS", !!existingContract);
  } catch (error) {
    console.error("Error checking contract:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to check contract");
  }
});

// POST /api/contracts
router.post('/', requireEditor, async (req, res) => {
  try {
    const { dappId, address, hasSwap, swapAddress } = req.body;

    if (!dappId || !address) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: dappId, address");
    }

    if (ethers.isAddress(address) === false) {
      return createResponse(res, "BAD_REQUEST", "Invalid address");
    }

    // Validate swap address if hasSwap is true
    if (hasSwap && (!swapAddress || !ethers.isAddress(swapAddress))) {
      return createResponse(res, "BAD_REQUEST", "Invalid swap address");
    }

    // Check if the DApp has API keys
    const dappHasApiKeys = await checkDappHasApiKeys(dappId);
    
    if (dappHasApiKeys) {
      // For DApps with API keys: check if contract exists in any DApp with API keys
      const existingContract = await checkContractExistsForApiKeyDapps(address);
      if (existingContract) {
        return createResponse(res, "BAD_REQUEST", "Contract already exists in a DApp with API keys");
      }
    } else {
      // For DApps without API keys: check if contract exists in any DApp without API keys
      const existingContract = await checkContractExistsForNoApiKeyDapps(address);
      if (existingContract) {
        return createResponse(res, "BAD_REQUEST", "Contract already exists in a DApp without API keys");
      }
    }

    const newContract = await prisma.contract.create({
      data: {
        address: address.toLowerCase(),
        dappId,
        hasSwap: hasSwap || false,
        swapAddress: hasSwap ? swapAddress.toLowerCase() : null,
        active: true,
      },
    });

    return createResponse(res, "SUCCESS", newContract);
  } catch (error) {
    console.error("Error adding contract:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to add contract");
  }
});

// DELETE /api/contracts
router.delete('/', requireEditor, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: id");
    }

    const contract = await prisma.contract.update({
      where: {
        id,
      },
      data: {
        active: false,
      },
    });

    return createResponse(res, "SUCCESS", contract);
  } catch (error) {
    console.error("Error deactivating contract:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to deactivate contract");
  }
});

module.exports = router; 