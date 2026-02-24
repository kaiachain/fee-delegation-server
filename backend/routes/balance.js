const express = require('express');
const router = express.Router();
const v2Router = express.Router();
const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { createResponse, isEnoughBalance, checkWhitelistedAndGetDapp, getDappByApiKey } = require('../utils/apiUtils');
const { formatKaia } = require('@kaiachain/ethers-ext/v6');

/**
 * Shared logic for resolving a DApp and its balance from the request.
 * Returns { balance } on success, or calls createResponse and returns null on error.
 */
async function resolveDappBalance(req, res) {
  const address = req.query.address;

  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

  if (address && !ethers.isAddress(address)) {
    createResponse(res, "BAD_REQUEST", "Invalid address");
    return null;
  }

  let balance = null;

  if (apiKey) {
    const dapp = await getDappByApiKey(apiKey?.toLowerCase() || "");
    if (!dapp) {
      createResponse(res, "BAD_REQUEST", "Invalid API key");
      return null;
    }
    balance = dapp.balance;
  } else if (address) {
    const { isWhitelisted, dapp: foundDapp } = await checkWhitelistedAndGetDapp(address.toLowerCase(), address.toLowerCase());

    if (!isWhitelisted) {
      createResponse(res, "BAD_REQUEST", "Address not found. If your DApp uses API keys, please include the API key in the Authorization header.");
      return null;
    }

    if (!foundDapp) {
      createResponse(res, "NOT_FOUND", "DApp not found");
      return null;
    }

    balance = foundDapp.balance;
  } else {
    createResponse(res, "BAD_REQUEST", "API key or address is required");
    return null;
  }

  if (!balance) {
    createResponse(res, "NOT_FOUND", "Balance not found");
    return null;
  }

  return { balance };
}

// OPTIONS /api/balance - Handle CORS preflight
router.options('/', async (req, res) => {
  return createResponse(res, 'SUCCESS', {});
});

/**
 * @swagger
 * /api/balance:
 *   get:
 *     tags: [Balance]
 *     summary: Check if DApp has sufficient balance
 *     description: |
 *       Check if DApp has sufficient balance for fee delegation. Returns a boolean indicating whether the balance exceeds the minimum threshold (0.1 KAIA).
 *       
 *       **Authentication Options:**
 *       - **API Key**: Provide Bearer token to check associated DApp balance
 *       - **Address Parameter**: Provide address parameter for whitelisted addresses
 *       
 *       **Usage:**
 *       - With API Key: `GET /api/balance` + Authorization header
 *       - With API Key + Address: `GET /api/balance?address=0x...` + Authorization header
 *       - With Address only: `GET /api/balance?address=0x...` (no auth required for whitelisted addresses)
 *       
 *       **Note:** DApps that have API keys configured require authentication via the API key.
 *       Address-only access (without API key) only works for DApps that do not have any API keys configured.
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
 *     responses:
 *       200:
 *         description: Balance check successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: boolean
 *                   description: Whether the DApp has sufficient balance (> 0.1 KAIA)
 *                 status:
 *                   type: boolean
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
 *               missing_input:
 *                 summary: Missing API Key and Address
 *                 value:
 *                   message: "Bad request"
 *                   data: "API key or address is required"
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
 *               address_not_found:
 *                 summary: Address Not Found
 *                 value:
 *                   message: "Bad request"
 *                   data: "Address not found. If your DApp uses API keys, please include the API key in the Authorization header."
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
    const result = await resolveDappBalance(req, res);
    if (!result) return;

    const hasEnoughBalance = isEnoughBalance(BigInt(result.balance));
    return createResponse(res, "SUCCESS", hasEnoughBalance);
  } catch (error) {
    console.error("Balance check error:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to check balance");
  }
});

/**
 * @swagger
 * /api/v2/balance:
 *   get:
 *     tags: [Balance]
 *     summary: Check DApp balance with details
 *     description: |
 *       Check if DApp has sufficient balance for fee delegation and return the actual balance in KAIA.
 *       
 *       **Authentication Options:**
 *       - **API Key**: Provide Bearer token to check associated DApp balance
 *       - **Address Parameter**: Provide address parameter for whitelisted addresses
 *       
 *       **Usage:**
 *       - With API Key: `GET /api/v2/balance` + Authorization header
 *       - With API Key + Address: `GET /api/v2/balance?address=0x...` + Authorization header
 *       - With Address only: `GET /api/v2/balance?address=0x...` (no auth required for whitelisted addresses)
 *       
 *       **Note:** DApps that have API keys configured require authentication via the API key.
 *       Address-only access (without API key) only works for DApps that do not have any API keys configured.
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
 *     responses:
 *       200:
 *         description: Balance check successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     isEnough:
 *                       type: boolean
 *                       description: Whether the DApp has sufficient balance (> 0.1 KAIA)
 *                     balance:
 *                       type: string
 *                       description: DApp balance in KAIA (4 decimal places)
 *                 status:
 *                   type: boolean
 *             examples:
 *               sufficient_balance:
 *                 summary: Sufficient Balance
 *                 value:
 *                   message: "Request was successful"
 *                   data:
 *                     isEnough: true
 *                     balance: "150.5000"
 *                   status: true
 *               insufficient_balance:
 *                 summary: Insufficient Balance
 *                 value:
 *                   message: "Request was successful"
 *                   data:
 *                     isEnough: false
 *                     balance: "0.0500"
 *                   status: true
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_input:
 *                 summary: Missing API Key and Address
 *                 value:
 *                   message: "Bad request"
 *                   data: "API key or address is required"
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
 *               address_not_found:
 *                 summary: Address Not Found
 *                 value:
 *                   message: "Bad request"
 *                   data: "Address not found. If your DApp uses API keys, please include the API key in the Authorization header."
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

// OPTIONS /api/v2/balance - Handle CORS preflight
v2Router.options('/', async (req, res) => {
  return createResponse(res, 'SUCCESS', {});
});

// GET /api/v2/balance
v2Router.get('/', async (req, res) => {
  try {
    const result = await resolveDappBalance(req, res);
    if (!result) return;

    const hasEnoughBalance = isEnoughBalance(BigInt(result.balance));
    const balanceInKaia = parseFloat(formatKaia(result.balance)).toFixed(4);
    return createResponse(res, "SUCCESS", { isEnough: hasEnoughBalance, balance: balanceInKaia });
  } catch (error) {
    console.error("Balance v2 check error:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to check balance");
  }
});

module.exports = { balanceRouter: router, balanceV2Router: v2Router };
