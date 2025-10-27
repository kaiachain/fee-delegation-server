const express = require('express');
const router = express.Router();
const { Wallet, parseTransaction, formatKaia } = require('@kaiachain/ethers-ext/v6');
const { pickProviderFromPool } = require('../utils/rpcProvider');
const { prisma } = require('../utils/prisma');
const {
  createResponse,
  sanitizeErrorMessage,
  logError,
  getCleanErrorMessage,
  checkWhitelistedAndGetDapp,
  isEnoughBalance,
  validateSwapTransaction,
  getDappByApiKey,
} = require('../utils/apiUtils');

// OPTIONS /api/signAsFeePayer
router.options('/', async (req, res) => {
  return createResponse(res, 'SUCCESS', {}, null);
});

/**
 * @swagger
 * /api/signAsFeePayer:
 *   post:
 *     tags: [Fee Delegation]
 *     summary: Submit fee-delegated transaction
 *     description: |
 *       Submit a user-signed fee-delegated transaction to be processed and paid by the fee delegation service.
 *       
 *       **Authentication Options:**
 *       - **API Key**: Include Bearer token in Authorization header
 *       - **Address Whitelisting**: No authentication required if sender/contract is whitelisted
 *       
 *       **Validation Rules:**
 *       - Gas price must not exceed 50 gwei (50,000,000,000 wei)
 *       - Sender/contract addresses must be whitelisted (unless using API key)
 *       - DApp must be active and have sufficient balance
 *       - Transaction must be properly signed and formatted
 *       
 *       **Response includes:**
 *       - Unique request ID for error tracking
 *       - Sanitized error messages (RPC URLs hidden for security)
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userSignedTx:
 *                 type: object
 *                 properties:
 *                   raw:
 *                     type: string
 *                     description: User signed RLP encoded transaction
 *     responses:
 *       200:
 *         description: Transaction processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - $ref: '#/components/schemas/RevertedResponse'
 *             examples:
 *               success:
 *                 summary: Successful Transaction
 *                 value:
 *                   message: "Request was successful"
 *                   data:
 *                     _type: "TransactionReceipt"
 *                     blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 *                     blockNumber: 12345678
 *                     contractAddress: null
 *                     cumulativeGasUsed: "21000"
 *                     from: "0x1234567890123456789012345678901234567890"
 *                     gasPrice: "25000000000"
 *                     blobGasUsed: null
 *                     blobGasPrice: null
 *                     gasUsed: "21000"
 *                     hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                     index: 0
 *                     logs: []
 *                     logsBloom: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
 *                     status: 1
 *                     to: "0x9876543210987654321098765432109876543210"
 *                   status: true
 *                   requestId: "req123abc456def789"
 *               reverted:
 *                 summary: Transaction Reverted
 *                 value:
 *                   message: "Transaction reverted"
 *                   data:
 *                     _type: "TransactionReceipt"
 *                     blockHash: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
 *                     blockNumber: 87654321
 *                     contractAddress: null
 *                     cumulativeGasUsed: "50000"
 *                     from: "0x1111111111111111111111111111111111111111"
 *                     gasPrice: "30000000000"
 *                     gasUsed: "45000"
 *                     hash: "0x9999999999999999999999999999999999999999999999999999999999999999"
 *                     status: 0
 *                     to: "0x2222222222222222222222222222222222222222"
 *                   error: "REVERTED"
 *                   status: false
 *                   requestId: "rev456def789abc123"
 *       400:
 *         description: Bad request - validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               parsing_error:
 *                 summary: Transaction Parsing Error
 *                 value:
 *                   message: "Bad request"
 *                   data: "Failed to parse transaction: Invalid transaction format"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *                   requestId: "parse123error456"
 *               gas_limit_exceeded:
 *                 summary: Gas Price Too High
 *                 value:
 *                   message: "Bad request"
 *                   data: "Gas price exceeds maximum limit of 50 gwei"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *                   requestId: "gas789limit123"
 *               not_whitelisted:
 *                 summary: Address Not Whitelisted
 *                 value:
 *                   message: "Bad request"
 *                   data: "Contract or sender address are not whitelisted"
 *                   error: "BAD_REQUEST"
 *                   status: false
 *                   requestId: "whitelist456error"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               rpc_error:
 *                 summary: RPC Network Error
 *                 value:
 *                   message: "Internal server error"
 *                   data: "Sending transaction was failed after 5 try, network is busy. Error message: Network timeout [RPC_URL_HIDDEN]"
 *                   error: "INTERNAL_ERROR"
 *                   status: false
 *                   requestId: "rpc123network456"
 *               settlement_error:
 *                 summary: Settlement Failed
 *                 value:
 *                   message: "Internal server error"
 *                   data: "Settlement failed: Database connection error"
 *                   error: "INTERNAL_ERROR"
 *                   status: false
 *                   requestId: "settle789error123"
 */
router.post('/', async (req, res) => {
  const uniqueId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  try {
    const { userSignedTx } = req.body || {};

    // Extract authorization token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const apiKey = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!userSignedTx || userSignedTx.raw === undefined) {
      console.error('Request ID:'+ uniqueId + ' - userSignedTx is required, [format] -- { userSignedTx: { raw: user signed rlp encoded transaction } }');
      return createResponse(res, 'BAD_REQUEST', 'userSignedTx is required, [format] -- { userSignedTx: { raw: user signed rlp encoded transaction } }', uniqueId);
    }

    const userSignedTxRlp = userSignedTx.raw;
    let tx;
    try {
      console.log('Request ID:'+ uniqueId + ' - Start : ' + userSignedTxRlp);
      tx = parseTransaction(userSignedTxRlp);
      console.log('Request ID:'+ uniqueId + ' - Tx Parsed: ' + JSON.stringify(tx));
    } catch (e) {
      // Log error cleanly and return sanitized message to client
      logError(e, uniqueId, 'Transaction parsing failed');
      return createResponse(res, 'BAD_REQUEST', `Failed to parse transaction: ${getCleanErrorMessage(e)}`, uniqueId);
    }

    // Add gas limit validation (50 gwei max)
    const MAX_GAS_PRICE = BigInt('50000000000'); // 50 gwei in wei
    const currentGasPrice = BigInt(tx.gasPrice || '0');
    if (currentGasPrice > MAX_GAS_PRICE) {
      console.error('Request ID:'+ uniqueId + ' - Gas price too high: ' + currentGasPrice.toString() + ' wei (max: ' + MAX_GAS_PRICE.toString() + ' wei)');
      return createResponse(res, 'BAD_REQUEST', 'Gas price exceeds maximum limit of 50 gwei', uniqueId);
    }

    let dapp;
    const targetContract = (tx.to || '').toLowerCase();
    const sender = (tx.from || '').toLowerCase();

    // if it's testnet, allow all transactions
    if (process.env.NETWORK === 'mainnet') {
      // First check if API key is present and valid
      if (apiKey) {
        const apiKeyDapp = await getDappByApiKey(apiKey);
        if (!apiKeyDapp) {
          return createResponse(res, 'BAD_REQUEST', 'Invalid API key', uniqueId);
        }

        // Enrich dapp with contracts and senders for whitelist checks and swap validation
        dapp = await prisma.dApp.findUnique({
          where: { id: apiKeyDapp.id },
          include: { contracts: true, senders: true }
        });

        if (!dapp) {
          console.error('Request ID:'+ uniqueId + ' - Dapp not configured. Please contact the administrator.');
          return createResponse(res, 'BAD_REQUEST', 'Dapp not configured. Please contact the administrator.', uniqueId);
        }

        if (Array.isArray(dapp.contracts) && dapp.contracts.length > 0 || Array.isArray(dapp.senders) && dapp.senders.length > 0) {
          const isContractWhitelisted = (dapp.contracts || []).some((contract) => contract.address === targetContract);
          const isSenderWhitelisted = (dapp.senders || []).some((_sender) => _sender.address === sender);

          if (!isContractWhitelisted && !isSenderWhitelisted) {
            console.error('Request ID:'+ uniqueId + ' - Contract or sender address are not whitelisted');
            return createResponse(res, 'BAD_REQUEST', 'Contract or sender address are not whitelisted', uniqueId);
          }
        }
      } else {
        // If no API key, fall back to contract/sender validation
        const { isWhitelisted, dapp: foundDapp } = await checkWhitelistedAndGetDapp(targetContract, sender);

        if (!isWhitelisted) {
          console.error('Request ID:'+ uniqueId + ' - Contract or sender address are not whitelisted');
          return createResponse(res, 'BAD_REQUEST', 'Contract or sender address are not whitelisted', uniqueId);
        }

        tx.feePayer = process.env.ACCOUNT_ADDRESS || '';
        dapp = foundDapp;

        if (!dapp) {
          console.error('Request ID:'+ uniqueId + ' - Dapp not configured. Please contact the administrator.');
          return createResponse(res, 'BAD_REQUEST', 'Dapp not configured. Please contact the administrator.', uniqueId);
        }
      }

      // Transform dapp data for swap validation
      const dappWithContracts = {
        name: dapp.name,
        contracts: (dapp.contracts || []).map((contract) => ({
          hasSwap: contract.hasSwap,
          address: contract.address,
          swapAddress: contract.swapAddress || undefined,
        })),
      };

      // Validate swap transaction if required
      const isValidSwap = await validateSwapTransaction(dappWithContracts, tx);
      if (!isValidSwap) {
        console.error('Request ID:'+ uniqueId + ' - Swap token address is not whitelisted');
        return createResponse(res, 'BAD_REQUEST', 'Swap token address is not whitelisted', uniqueId);
      }

      // Check if DApp is active
      if (!dapp?.active) {
        console.error('Request ID:'+ uniqueId + ' - DApp is inactive. Please contact the administrator to activate the DApp.');
        return createResponse(res, 'BAD_REQUEST', 'DApp is inactive. Please contact the administrator to activate the DApp.', uniqueId);
      }

      if (!isEnoughBalance(BigInt(dapp.balance || '0'))) {
        console.error('Request ID:'+ uniqueId + ' - Insufficient balance in fee delegation server, please contact the administrator.');
        return createResponse(res, 'BAD_REQUEST', 'Insufficient balance in fee delegation server, please contact the administrator.', uniqueId);
      }

      // Check if the Dapp has a termination date
      if (dapp.terminationDate) {
        const terminationDate = new Date(dapp.terminationDate);
        const now = new Date();
        // Convert both dates to KST (UTC+9)
        const kstTerminationDate = new Date(terminationDate.getTime() + 9 * 60 * 60 * 1000);
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

        // Add one day to termination date to make it exclusive
        const nextDayAfterTermination = new Date(kstTerminationDate);
        nextDayAfterTermination.setDate(nextDayAfterTermination.getDate() + 1);

        if (kstNow >= nextDayAfterTermination) {
          console.error('Request ID:'+ uniqueId + ' - DApp is terminated. Please contact the administrator to activate the DApp.');
          return createResponse(res, 'BAD_REQUEST', 'DApp is terminated. Please contact the administrator to activate the DApp.', uniqueId);
        }
      }
    }

    const provider = pickProviderFromPool();
    const feePayer = new Wallet(
      process.env.ACCOUNT_ADDRESS || '',
      process.env.FEE_PAYER_PRIVATE_KEY || '',
      provider
    );
    console.info('Request ID:'+ uniqueId + ' - signAsFeePayer using fee payer wallet:', feePayer.address);

    const feePayerSignedTx = await feePayer.signTransactionAsFeePayer(tx);
    let txHash;
    let sendCnt = 0;
    let errorMessage = '';
    do {
      try {
        txHash = await provider.send('klay_sendRawTransaction', [feePayerSignedTx]);
        if (txHash) break;
      } catch (e) {
        // Log the RPC error with full details (including RPC URL for debugging)
        console.error('Request ID:'+ uniqueId + ' - [' + sendCnt + ' try] Transaction send failed: sender - ' + sender + ', contract - ' + targetContract);
        console.error('Request ID:'+ uniqueId + ' - Send Error:', e?.error?.message || e?.message || e);
        errorMessage = getCleanErrorMessage(e);
        // Ignore known transaction errors as requested - skip this check entirely
      }
      sendCnt++;
    } while (sendCnt < 5);

    if (!txHash) {
      console.error('Request ID:'+ uniqueId + ' - Sending transaction was failed after 5 try, network is busy. Error message: ' + errorMessage);
      return createResponse(res, 'INTERNAL_ERROR', `Sending transaction was failed after 5 try, network is busy. Error message: ${sanitizeErrorMessage(errorMessage)}`, uniqueId);
    }

    let receipt;
    let waitCnt = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('Request ID:'+ uniqueId + ' - waiting for signAsFeePayer receipt', waitCnt);
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          break;
        }
      } catch (e) {
        logError(e, uniqueId, 'Getting transaction receipt failed');
      }

      waitCnt++;
    } while (waitCnt < 15);

    if (!receipt) {
      console.error('Request ID:'+ uniqueId + ' - Transaction was failed');
      return createResponse(res, 'INTERNAL_ERROR', 'Transaction was failed', uniqueId);
    }

    try {
      console.log('Request ID:'+ uniqueId + ' - Settlement started');
      const targetContract = (receipt.to || tx.to || '').toLowerCase();
      const sender = (receipt.from || tx.from || '').toLowerCase();
      await settlement({ dapp, receipt, targetContract, sender, txHash });
    } catch (error) {
      logError(error, uniqueId, 'Settlement failed');
      return createResponse(res, 'INTERNAL_ERROR', `Settlement failed: ${getCleanErrorMessage(error)}`, uniqueId);
    }

    if (receipt.status === 0) {
      console.error('Request ID:'+ uniqueId + ' - [REVERTED] Transaction hash: ', txHash);
      return createResponse(res, 'REVERTED', receipt, uniqueId);
    }

    console.info('Request ID:'+ uniqueId + ' - [SUCCESS] Transaction hash: ', txHash);
    return createResponse(res, 'SUCCESS', receipt, uniqueId);
  } catch (error) {
    // Log the main error cleanly
    logError(error, uniqueId, 'Main request processing failed');
    return createResponse(res, 'INTERNAL_ERROR', getCleanErrorMessage(error), uniqueId);
  }
});

async function settlement({ dapp, receipt, targetContract, sender, txHash }) {
  if (process.env.NETWORK !== 'mainnet') {
    return;
  }

  if (!dapp) {
    throw new Error('Settlement failed');
  }

  const gasPriceValue = receipt?.gasPrice ?? receipt?.effectiveGasPrice;
  if (receipt?.gasUsed === undefined || gasPriceValue === undefined) {
    throw new Error('field missing in receipt:' + JSON.stringify(receipt));
  }

  const gasUsed = typeof receipt.gasUsed === 'bigint' ? receipt.gasUsed : BigInt(receipt.gasUsed);
  const gasPrice = typeof gasPriceValue === 'bigint' ? gasPriceValue : BigInt(gasPriceValue);
  const usedFee = gasUsed * gasPrice;

  const contractAddressForLog = targetContract || sender;
  let nextBalance;
  let nextTotalUsed;

  await prisma.$transaction(async (tx) => {
    const currentSnapshot = await tx.dApp.findUnique({
      where: { id: dapp.id },
      select: {
        balance: true,
        totalUsed: true,
      },
    });

    if (!currentSnapshot) {
      throw new Error(`DApp ${dapp.id} not found during settlement`);
    }

    nextBalance = (BigInt(currentSnapshot.balance) - usedFee).toString();
    nextTotalUsed = (BigInt(currentSnapshot.totalUsed) + usedFee).toString();

    await tx.dApp.update({
      where: { id: dapp.id },
      data: {
        balance: nextBalance,
        totalUsed: nextTotalUsed,
      },
    });

    if (targetContract) {
      await tx.contractUsage.upsert({
        where: {
          dappId_contractAddress: {
            dappId: dapp.id,
            contractAddress: targetContract,
          },
        },
        update: {
          totalUsed: { increment: usedFee },
        },
        create: {
          dappId: dapp.id,
          contractAddress: targetContract,
          totalUsed: usedFee,
        },
      });
    }

    await tx.transactionLog.create({
      data: {
        dappId: dapp.id,
        contractAddress: contractAddressForLog,
        senderAddress: sender,
        usedFee,
        gasUsed,
        gasPrice,
        txHash,
        blockNumber: BigInt(receipt.blockNumber ?? 0),
      },
    });
  });

  // Get updated DApp with email alerts
  const updatedDapp = await prisma.dApp.findUnique({
    where: { id: dapp.id },
    include: {
      emailAlerts: {
        where: { isActive: true },
      },
    },
  });

  if (updatedDapp) {
    const newBalance = BigInt(updatedDapp.balance);

    // Check each email alert threshold
    for (const alert of updatedDapp.emailAlerts) {
      const threshold = BigInt(alert.balanceThreshold);
      // If balance is now below threshold
      if (newBalance < threshold) {
        try {
          // Send email alert
          const emailResult = await sendBalanceAlertEmail({
            email: alert.email,
            dappName: updatedDapp.name,
            newBalance: newBalance.toString(),
            threshold: threshold.toString(),
          });

          if (emailResult.success) {
            // Log the email alert
            await prisma.emailAlertLog.create({
              data: {
                email: alert.email,
                dappId: updatedDapp.id,
                dappName: updatedDapp.name,
                newBalance: newBalance.toString(),
                threshold: threshold.toString(),
              },
            });

            // Disable the alert after sending
            await prisma.emailAlert.update({
              where: { id: alert.id },
              data: { isActive: false },
            });

            console.log(`Email alert sent to ${alert.email} for DApp ${updatedDapp.name}`);
          } else {
            console.error(`Failed to send email alert to ${alert.email}:`, emailResult.error);
          }
        } catch (error) {
          console.error(`Error sending email alert to ${alert.email}:`, error);
        }
      }
    }
  }

  // keep local dapp snapshot in sync for downstream logic
  if (nextBalance !== undefined) {
    dapp.balance = nextBalance;
  }
  if (nextTotalUsed !== undefined) {
    dapp.totalUsed = nextTotalUsed;
  }
}

async function sendBalanceAlertEmail({ email, dappName, newBalance, threshold }) {
  try {
    const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const from = process.env.FROM_EMAIL;

    if (!from) {
      console.warn('AWS SES not configured; skipping email send');
      return { success: false, error: 'AWS SES not configured. Please set FROM_EMAIL' };
    }

    // Build SES client configuration
    const clientConfig = { region };
    
    // Only include credentials if both are provided (for local development)
    // If not provided, AWS SDK will use IAM roles, instance profiles, or other credential providers
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    const sesClient = new SESClient(clientConfig);

    const newBalanceFormatted = parseFloat(formatKaia(newBalance)).toFixed(4);
    const thresholdFormatted = parseFloat(formatKaia(threshold)).toFixed(4);

    const subject = `Fee Delegation Alert - ${dappName} balance below threshold`;
    const text = `DApp: ${dappName}\nNew Balance (KAIA): ${newBalanceFormatted}\nThreshold (KAIA): ${thresholdFormatted}`;
    const html = ` <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>KAIA Fee Delegation Alert</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; line-height: 1.6;">
          
          <!-- Email Container -->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background-color: #374151; padding: 30px 40px; text-align: center;">
              <table style="display: inline-block; margin-bottom: 15px;">
                <tr>
                  <td style="background-color: #4b5563; border-radius: 50%; width: 60px; height: 60px; text-align: center; vertical-align: middle;">
                    <span style="font-size: 24px; color: white; line-height: 60px;">🔔</span>
                  </td>
                </tr>
              </table>
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">
                KAIA Fee Delegation System
              </h1>
              <p style="color: #d1d5db; margin: 10px 0 0 0; font-size: 16px;">
                Balance Alert Notification
              </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px;">
              
              <!-- Greeting -->
              <div style="margin-bottom: 30px;">
                <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">
                  Hello there! 👋
                </h2>
                <p style="color: #6b7280; margin: 0; font-size: 16px;">
                  This is an automated alert from the KAIA fee delegation system. Your DApp balance has fallen below the configured threshold.
                </p>
              </div>
              
              <!-- Alert Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 25px; margin: 30px 0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                  <table style="display: inline-block; margin-right: 15px;">
                    <tr>
                      <td style="background-color: #ef4444; border-radius: 50%; width: 40px; height: 40px; text-align: center; vertical-align: middle;">
                        <span style="color: white; font-size: 16px; line-height: 40px;">⚠️</span>
                      </td>
                    </tr>
                  </table>
                  <h3 style="color: #b91c1c; margin: 0; font-size: 18px; font-weight: 600;">
                    Balance Alert
                  </h3>
                </div>
                
                <div style="background-color: white; border-radius: 6px; padding: 20px; margin-top: 15px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        DApp Name
                      </p>
                      <p style="color: #1f2937; margin: 0; font-size: 16px; font-weight: 600;">
                        ${dappName}
                      </p>
                    </div>
                    <br/>
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        Current Balance
                      </p>
                      <p style="color: #ef4444; margin: 0; font-size: 16px; font-weight: 600;">
                        ${newBalanceFormatted} KAIA
                      </p>
                    </div>
                    <br/>
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        Threshold
                      </p>
                      <p style="color: #1f2937; margin: 0; font-size: 16px; font-weight: 600;">
                        ${thresholdFormatted} KAIA
                      </p>
                    </div>
                    <br/>
                    <div>
                      <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                        Status
                      </p>
                      <span style="background-color: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        CRITICAL
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="https://fee-delegation.kaia.io/rank" target="_blank" style="display: inline-block; background-color: #374151; color: white; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                  Check DApp Balance
                </a>
              </div>
              
              <!-- Message -->
              <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-top: 30px;">
                <h4 style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
                  What you should do:
                </h4>
                <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Add more balance to your DApp to continue fee delegation services</li>
                  <li style="margin-bottom: 8px;">Monitor your balance regularly to avoid service interruption</li>
                  <li style="margin-bottom: 0;">Consider setting up automatic balance replenishment</li>
                </ul>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 25px 40px; text-align: center;">
              <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">
                This is an automated alert from the KAIA Fee Delegation System.
              </p>
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                © 2025 KAIA Labs Limited. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>`;

    const command = new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
        },
      },
    });

    await sesClient.send(command);
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

module.exports = router; 