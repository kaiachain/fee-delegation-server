const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { createResponse, isEnoughBalance, checkWhitelistedAndGetDapp, getDappByApiKey } = require('../utils/apiUtils');

/**
 * @swagger
 * /api/balance:
 *   get:
 *     tags: [Balance]
 *     summary: Check DApp balance
 *     description: |
 *       Check if DApp has sufficient balance for fee delegation.
 *       
 *       **Authentication Options:**
 *       - **API Key**: Provide Bearer token to check associated DApp balance
 *       - **Address Parameter**: Provide address parameter for whitelisted addresses
 *       
 *       **Usage:**
 *       - With API Key: `GET /api/balance` + Authorization header
 *       - With Address: `GET /api/balance?address=0x...` (no auth required for whitelisted addresses)
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - name: address
 *         in: query
 *         description: Contract or sender address to check balance for (required when no API key provided)
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *           example: "0x742d35Cc6634C0532925a3b8D2A4DDDeAe0e4Cd3"
 *     responses:
 *       200:
 *         description: Balance check successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BalanceResponse'
 *             examples:
 *               sufficient_balance:
 *                 summary: Sufficient Balance
 *                 value:
 *                   message: "Request was successful"
 *                   data: true
 *                   status: true
 *               insufficient_balance:
 *                 summary: Insufficient Balance
 *                 value:
 *                   message: "Request was successful"
 *                   data: false
 *                   status: true
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_input:
 *                 summary: Invalid Input
 *                 value:
 *                   message: "Bad request"
 *                   data: "Invalid Input"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *               invalid_address:
 *                 summary: Invalid Address Format
 *                 value:
 *                   message: "Bad request"
 *                   data: "Invalid address"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *               invalid_api_key:
 *                 summary: Invalid API Key
 *                 value:
 *                   message: "Bad request"
 *                   data: "Invalid API key"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *               address_not_whitelisted:
 *                 summary: Address Not Whitelisted
 *                 value:
 *                   message: "Bad request"
 *                   data: "Address not whitelisted"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *       404:
 *         description: Resource not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               dapp_not_found:
 *                 summary: DApp Not Found
 *                 value:
 *                   message: "Not found"
 *                   data: "DApp not found"
 *                   error: "NOT_FOUND"
 *                   status: false
 *               balance_not_found:
 *                 summary: Balance Not Found
 *                 value:
 *                   message: "Not found"
 *                   data: "Balance not found"
 *                   error: "NOT_FOUND"
 *                   status: false
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Internal server error"
 *               data: "Failed to check balance"
 *               error: "INTERNAL_ERROR"
 *               status: false
 */
// GET /api/balance
router.get('/', async (req, res) => {
  try {
    const address = req.query.address;

    // Extract authorization token
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;
    
    if(!address) {
      return createResponse(res, "BAD_REQUEST", "Invalid Input");
    }

    if (address && !ethers.isAddress(address)) {
      return createResponse(res, "BAD_REQUEST", "Invalid address");
    }

    let dapp;
    let balance = null;

    // Check if API key is present and valid
    if (apiKey) {
      dapp = await getDappByApiKey(apiKey?.toLowerCase() || "");
      if (!dapp) {
        return createResponse(res, "BAD_REQUEST", "Invalid API key");
      }
      
      balance = dapp.balance;
    } else {
      // If no API key, fall back to contract/sender validation for non-API key DApps
      if (!address) {
        return createResponse(res, "BAD_REQUEST", "Address is required");
      }
      const { isWhitelisted, dapp: foundDapp } = await checkWhitelistedAndGetDapp(address.toLowerCase(), address.toLowerCase());

      if (!isWhitelisted) {
        return createResponse(res, "BAD_REQUEST", "Address not whitelisted");
      }
      
      if (!foundDapp) {
        return createResponse(res, "NOT_FOUND", "DApp not found");
      }
      
      dapp = foundDapp;
      balance = dapp.balance;
    }

    if (!balance) {
      return createResponse(res, "NOT_FOUND", "Balance not found");
    }

    const hasEnoughBalance = isEnoughBalance(BigInt(balance));
    return createResponse(res, "SUCCESS", hasEnoughBalance);
  } catch (error) {
    console.error("Balance check error:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to check balance");
  }
});

module.exports = router; 