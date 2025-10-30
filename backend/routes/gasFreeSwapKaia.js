const express = require('express');
const router = express.Router();
const { Wallet, TxType, parseKlay } = require('@kaiachain/ethers-ext/v6');
const { pickProviderFromPool } = require('../utils/rpcProvider');
const {
  createResponse,
  sanitizeErrorMessage,
  logError,
  getCleanErrorMessage,
  sanitizeTransactionReceipt,
} = require('../utils/apiUtils');
const { ethers } = require('ethers');
const { randomBytes } = require('crypto');

const GASLESS_SWAP_ABI = [
  'function executeSwapWithPermit(address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, uint256 deadline, uint8 v, bytes32 r, bytes32 s)'
];

const MAX_GAS_PRICE = BigInt('50000000000'); // 50 gwei
const SWAP_CONTRACT_ADDRESS = (process.env.GASLESS_SWAP_CONTRACT_ADDRESS || '').toLowerCase();
const EXPECTED_TOKEN_IN = (process.env.GASLESS_SWAP_TOKEN_IN || '').toLowerCase();
const EXPECTED_TOKEN_OUT = (process.env.GASLESS_SWAP_TOKEN_OUT || '').toLowerCase();

/**
 * @swagger
 * /api/gasFreeSwapKaia:
 *   post:
 *     tags: [Gasless Swap]
 *     summary: Execute gasless ERC20 permit swap
 *     description: |
 *       Submit swap parameters and an ERC20 permit signature so the backend can execute `executeSwapWithPermit` on `GaslessERC20PermitSwap` using the admin wallet to pay gas.
 *       This public endpoint performs signature validation, checks that the user has zero KAIA balance, and returns the transaction receipt or error details.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               swap:
 *                 type: object
 *                 properties:
 *                   user:
 *                     type: string
 *                     description: Token owner who signed the permit
 *                   tokenIn:
 *                     type: string
 *                   tokenOut:
 *                     type: string
 *                   amountIn:
 *                     type: string
 *                     description: Amount of input tokens (as stringified integer)
 *                   amountOutMin:
 *                     type: string
 *                     description: Minimum expected output tokens
 *                   deadline:
 *                     type: string
 *                     description: Permit and swap deadline (unix timestamp seconds)
 *               permitSignature:
 *                 type: string
 *                 description: 65-byte hex signature representing {r, s, v}
 *             required: [swap, permitSignature]
 *     responses:
 *       200:
 *         description: Swap executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             examples:
 *               success:
 *                 summary: Successful gasless swap
 *                 value:
 *                   message: "Request was successful"
 *                   data:
 *                     _type: "TransactionReceipt"
 *                     blockHash: "0x1d4f..."
 *                     blockNumber: 123456
 *                     from: "0x1234..."
 *                     to: "0xabcd..."
 *                     gasUsed: "215000"
 *                     gasPrice: "25000000000"
 *                     hash: "0x9f83..."
 *                     status: 1
 *                   status: true
 *                   requestId: "req123abc456def789"
 *       400:
 *         description: Validation or transaction failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidPermit:
 *                 summary: Permit validation failed
 *                 value:
 *                   message: "Bad request"
 *                   data: "Permit deadline has expired"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *                   requestId: "req234bcd567efg890"
 *               txRevert:
 *                 summary: Transaction reverted on-chain
 *                 value:
 *                   message: "Bad request"
 *                   data: "execution reverted: Permit already used"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *                   requestId: "req345cde678fgh901"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               rpcFailure:
 *                 summary: RPC send failure
 *                 value:
 *                   message: "Internal server error"
 *                   data: "Sending transaction was failed after 5 try, network is busy. Error message: Network timeout [RPC_URL_HIDDEN]"
 *                   error: "INTERNAL_ERROR"
 *                   status: false
 *                   requestId: "req456def789ghi012"
 */
router.post('/', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  try {
    const { swap, permitSignature, ...unexpected } = req.body || {};

    if (!swap || !permitSignature || Object.keys(unexpected || {}).length > 0) {
      return createResponse(res, 'BAD_REQUEST', 'swap and permitSignature are required', requestId);
    }

    const {
      user,
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin,
      deadline
    } = swap || {};

    if (!user || !tokenIn || !tokenOut || amountIn === undefined || amountOutMin === undefined || deadline === undefined) {
      return createResponse(res, 'BAD_REQUEST', 'Missing required swap fields', requestId);
    }

    let signature;
    try {
      signature = ethers.Signature.from(permitSignature);
    } catch (sigError) {
      return createResponse(res, 'BAD_REQUEST', 'Permit signature must be a valid hex string', requestId);
    }

    if (!ethers.isAddress(user) || !ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
      return createResponse(res, 'BAD_REQUEST', 'Invalid address provided in swap data', requestId);
    }

    if (!SWAP_CONTRACT_ADDRESS) {
      console.error('Request ID:' + requestId + ' - Missing GASLESS_SWAP_CONTRACT_ADDRESS env');
      return createResponse(res, 'INTERNAL_ERROR', 'Server configuration error', requestId);
    }

    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();

    if (EXPECTED_TOKEN_IN && tokenInLower !== EXPECTED_TOKEN_IN) {
      return createResponse(res, 'BAD_REQUEST', 'tokenIn is not supported for this API', requestId);
    }

    if (EXPECTED_TOKEN_OUT && tokenOutLower !== EXPECTED_TOKEN_OUT) {
      return createResponse(res, 'BAD_REQUEST', 'tokenOut is not supported for this API', requestId);
    }

    let amountInValue;
    let amountOutMinValue;
    let deadlineValue;

    try {
      amountInValue = ethers.toBigInt(amountIn);
      amountOutMinValue = ethers.toBigInt(amountOutMin);
    } catch (parseError) {
      return createResponse(res, 'BAD_REQUEST', 'amountIn and amountOutMin must be numeric values', requestId);
    }

    if (amountInValue <= 0n || amountOutMinValue <= 0n) {
      return createResponse(res, 'BAD_REQUEST', 'amountIn and amountOutMin must be greater than zero', requestId);
    }

    try {
      deadlineValue = BigInt(deadline);
    } catch (parseError) {
      return createResponse(res, 'BAD_REQUEST', 'deadline must be a numeric value', requestId);
    }

    if (deadlineValue <= BigInt(Math.floor(Date.now() / 1000))) {
      return createResponse(res, 'BAD_REQUEST', 'Permit deadline has expired', requestId);
    }

    const vValue = signature.v;

    const adminAddress = process.env.ACCOUNT_ADDRESS || '';
    const adminPrivateKey = process.env.FEE_PAYER_PRIVATE_KEY;

    if (!adminAddress || !adminPrivateKey) {
      console.error('Request ID:' + requestId + ' - Missing admin account configuration');
      return createResponse(res, 'INTERNAL_ERROR', 'Server configuration error', requestId);
    }

    const provider = pickProviderFromPool();
    const adminWallet = new Wallet(adminAddress, adminPrivateKey, provider);
    const adminSenderWallet = new Wallet(adminPrivateKey, provider);

    let currentGasPrice = null;
    try {
      const feeData = await provider.getFeeData();
      if (feeData?.gasPrice !== undefined && feeData?.gasPrice !== null) {
        currentGasPrice = BigInt(feeData.gasPrice);
      }
    } catch (gasError) {
      logError(gasError, requestId, 'Gas price fetch failed');
    }

    if (currentGasPrice !== null && currentGasPrice > MAX_GAS_PRICE) {
      console.error('Request ID:' + requestId + ' - Gas price too high: ' + currentGasPrice.toString() + ' wei (max: ' + MAX_GAS_PRICE.toString() + ' wei)');
      return createResponse(res, 'BAD_REQUEST', 'Gas price exceeds maximum limit of 50 gwei, please try again later', requestId);
    }

    const userBalance = await provider.getBalance(user);
    if (process.env.NETWORK === 'mainnet' && userBalance > 0n) {
      console.error('Request ID:' + requestId + ' - User has non-zero KAIA balance');
      return createResponse(res, 'BAD_REQUEST', 'User must have zero KAIA balance to use this feature', requestId);
    }

    let txHash;
    let txResponse;
    let attempt = 0;
    let error = '';


    const tx = {
      type: TxType.FeeDelegatedSmartContractExecution,
      from: adminSenderWallet.address,
      to: SWAP_CONTRACT_ADDRESS,
      data: new ethers.Interface(GASLESS_SWAP_ABI).encodeFunctionData('executeSwapWithPermit', [
        user,
        tokenIn,
        tokenOut,
        amountInValue,
        amountOutMinValue,
        deadlineValue,
        vValue,
        signature.r,
        signature.s,
      ]),
      value: parseKlay("0"),
      gasPrice: currentGasPrice ?? undefined,
      feePayer: adminAddress,
    };

    tx.nonce = await adminSenderWallet.getNonce();
    tx.gasLimit = 400000;

    const senderTxHashRLP = await adminSenderWallet.signTransaction(tx);
    
    do {
      try {
        txResponse = await (await adminWallet.sendTransactionAsFeePayer(senderTxHashRLP)).wait();
        txHash = txResponse?.hash;
        if (txHash) break;
      } catch (sendErr) {
        logError(sendErr, requestId, 'Transaction send failed');
        error = getCleanErrorMessage(sendErr);
        const lowerMessage = (error || '').toLowerCase();
        const errorCode = sendErr?.code || sendErr?.error?.code;
        if (
          errorCode === 'CALL_EXCEPTION' ||
          errorCode === 'TRANSACTION_REVERTED' ||
          errorCode === 'UNPREDICTABLE_GAS_LIMIT' ||
          lowerMessage.includes('revert') ||
          lowerMessage.includes('insufficient')
        ) {
          return createResponse(res, 'BAD_REQUEST', error, requestId);
        }
      }
      attempt++;
    } while (attempt < 5);

    if (!txHash) {
      console.error('Request ID:' + requestId + ' - Sending transaction failed after retries');
      return createResponse(res, 'INTERNAL_ERROR', `Sending transaction was failed after 5 try, network is busy. Error message: ${sanitizeErrorMessage(error)}`, requestId);
    }

    let receipt;
    let waitCount = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('Request ID:'+ requestId + ' - waiting for gasFreeSwapKaiareceipt', waitCount);
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) break;
      } catch (receiptErr) {
        logError(receiptErr, requestId, 'Getting transaction receipt failed');
      }
      waitCount++;
    } while (waitCount < 15);

    if (!receipt) {
      console.error('Request ID:' + requestId + ' - Transaction was failed');
      return createResponse(res, 'INTERNAL_ERROR', 'Transaction was failed', requestId);
    }

    const sanitizedReceipt = sanitizeTransactionReceipt(receipt);

    if (receipt.status === 0) {
      console.error('Request ID:' + requestId + ' - [REVERTED] Transaction hash: ', txHash);
      return createResponse(res, 'REVERTED', sanitizedReceipt, requestId);
    }

    console.info('Request ID:' + requestId + ' - [SUCCESS] Transaction hash: ', txHash);
    return createResponse(res, 'SUCCESS', sanitizedReceipt, requestId);
  } catch (error) {
    logError(error, requestId, 'Main request processing failed');
    return createResponse(res, 'INTERNAL_ERROR', getCleanErrorMessage(error), requestId);
  }
});

module.exports = router;
