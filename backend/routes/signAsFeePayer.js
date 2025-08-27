const express = require('express');
const router = express.Router();
const { Wallet, parseTransaction, formatKaia } = require('@kaiachain/ethers-ext/v6');
const { pickProviderFromPool } = require('../utils/rpcProvider');
const { prisma } = require('../utils/prisma');
const {
  createResponse,
  checkWhitelistedAndGetDapp,
  isEnoughBalance,
  updateDappWithFee,
  validateSwapTransaction,
  getDappByApiKey,
} = require('../utils/apiUtils');

// OPTIONS /api/signAsFeePayer
router.options('/', async (req, res) => {
  return createResponse(res, 'SUCCESS', {});
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
 *       Authentication Options:
 *       - API Key: Include Bearer token in Authorization header
 *       - Address Whitelisting: No authentication required if sender/contract is whitelisted
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
 *       400:
 *         description: Bad request - validation failed
 *       500:
 *         description: Internal server error
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
      return createResponse(res, 'BAD_REQUEST', 'userSignedTx is required, [format] -- { userSignedTx: { raw: user signed rlp encoded transaction } }');
    }

    const userSignedTxRlp = userSignedTx.raw;
    let tx;
    try {
      tx = parseTransaction(userSignedTxRlp);
      console.log('Request ID:'+ uniqueId + ' - Tx Parsed: ' + JSON.stringify(tx));
    } catch (e) {
      console.error('Request ID:'+ uniqueId + ' - Tx Parsing Error: ' + JSON.stringify(e));
      return createResponse(res, 'BAD_REQUEST', 'Failed to parse transaction');
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
          return createResponse(res, 'BAD_REQUEST', 'Invalid API key');
        }

        // Enrich dapp with contracts and senders for whitelist checks and swap validation
        dapp = await prisma.dApp.findUnique({
          where: { id: apiKeyDapp.id },
          include: { contracts: true, senders: true }
        });

        if (!dapp) {
          console.error('Request ID:'+ uniqueId + ' - Dapp not configured. Please contact the administrator.');
          return createResponse(res, 'BAD_REQUEST', 'Dapp not configured. Please contact the administrator.');
        }

        if (Array.isArray(dapp.contracts) && dapp.contracts.length > 0 || Array.isArray(dapp.senders) && dapp.senders.length > 0) {
          const isContractWhitelisted = (dapp.contracts || []).some((contract) => contract.address === targetContract);
          const isSenderWhitelisted = (dapp.senders || []).some((_sender) => _sender.address === sender);

          if (!isContractWhitelisted && !isSenderWhitelisted) {
            console.error('Request ID:'+ uniqueId + ' - Contract or sender address are not whitelisted');
            return createResponse(res, 'BAD_REQUEST', 'Contract or sender address are not whitelisted');
          }
        }
      } else {
        // If no API key, fall back to contract/sender validation
        const { isWhitelisted, dapp: foundDapp } = await checkWhitelistedAndGetDapp(targetContract, sender);

        if (!isWhitelisted) {
          console.error('Request ID:'+ uniqueId + ' - Contract or sender address are not whitelisted');
          return createResponse(res, 'BAD_REQUEST', 'Contract or sender address are not whitelisted');
        }

        tx.feePayer = process.env.ACCOUNT_ADDRESS || '';
        dapp = foundDapp;

        if (!dapp) {
          console.error('Request ID:'+ uniqueId + ' - Dapp not configured. Please contact the administrator.');
          return createResponse(res, 'BAD_REQUEST', 'Dapp not configured. Please contact the administrator.');
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
        return createResponse(res, 'BAD_REQUEST', 'Swap token address is not whitelisted');
      }

      // Check if DApp is active
      if (!dapp?.active) {
        console.error('Request ID:'+ uniqueId + ' - DApp is inactive. Please contact the administrator to activate the DApp.');
        return createResponse(res, 'BAD_REQUEST', 'DApp is inactive. Please contact the administrator to activate the DApp.');
      }

      if (!isEnoughBalance(BigInt(dapp.balance || '0'))) {
        console.error('Request ID:'+ uniqueId + ' - Insufficient balance in fee delegation server, please contact the administrator.');
        return createResponse(res, 'BAD_REQUEST', 'Insufficient balance in fee delegation server, please contact the administrator.');
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
          return createResponse(res, 'BAD_REQUEST', 'DApp is terminated. Please contact the administrator to activate the DApp.');
        }
      }
    }

    const provider = pickProviderFromPool();
    const feePayer = new Wallet(
      process.env.ACCOUNT_ADDRESS || '',
      process.env.FEE_PAYER_PRIVATE_KEY || '',
      provider
    );

    const feePayerSignedTx = await feePayer.signTransactionAsFeePayer(tx);
    let txHash;
    let sendCnt = 0;
    let errorMessage = '';
    let isKnownTransaction = false;
    do {
      try {
        txHash = await provider.send('klay_sendRawTransaction', [feePayerSignedTx]);
        if (txHash) break;
      } catch (e) {
        console.log(e);
        errorMessage = e?.error?.message || e?.message || e;
        console.error('Request ID:'+ uniqueId + ' - [' + sendCnt + ' try]' + 'Transaction send failed: sender - ' + sender + ', contract - ' + targetContract);
        if(errorMessage?.includes('known transaction: ')) {
          isKnownTransaction = true;
          txHash = "0x" + errorMessage?.split('known transaction: ')[1];
          console.log('Request ID:'+ uniqueId + ' - Extracted txHash from known transaction: ', txHash);
          break;
        }
      }
      sendCnt++;
    } while (sendCnt < 5);

    if (!txHash) {
      console.error('Request ID:'+ uniqueId + ' - Sending transaction was failed after 5 try, network is busy. Error message: ' + errorMessage);
      return createResponse(res, 'INTERNAL_ERROR', 'Sending transaction was failed after 5 try, network is busy. Error message: ' + errorMessage);
    }

    let receipt;
    let waitCnt = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('Request ID:'+ uniqueId + ' - waiting for receipt', waitCnt);
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          break;
        }
      } catch (e) {
        console.error('Request ID:'+ uniqueId + ' - Error getting transaction receipt for txHash: ' + txHash + ' : ' + JSON.stringify(e));
      }

      waitCnt++;
    } while (waitCnt < 15);

    if (!receipt) {
      console.error('Request ID:'+ uniqueId + ' - Transaction was failed');
      return createResponse(res, 'INTERNAL_ERROR', 'Transaction was failed');
    }

    try {
      if(!isKnownTransaction) {
        console.log('Request ID:'+ uniqueId + ' - Settlement started');
        await settlement(dapp, receipt);
      }
    } catch (error) {
      console.error('Request ID:'+ uniqueId + ' - Error Settlement: ' + txHash + ' : ' + JSON.stringify(error));
      return createResponse(res, 'INTERNAL_ERROR', JSON.stringify(error));
    }

    if (receipt.status === 0) {
      console.error('Request ID:'+ uniqueId + ' - [REVERTED] Transaction hash: ', txHash);
      return createResponse(res, 'REVERTED', receipt);
    }

    console.info('Request ID:'+ uniqueId + ' - [SUCCESS] Transaction hash: ', txHash);
    return createResponse(res, 'SUCCESS', receipt);
  } catch (error) {
    const errorMsg = JSON.parse(JSON.stringify(error));
    console.error('Request ID:'+ uniqueId + ' - ' + JSON.stringify(errorMsg));

    const returnErrorMsg = (errorMsg && errorMsg.error && errorMsg.error.message) || errorMsg?.shortMessage;
    if (!returnErrorMsg) {
      console.error('Request ID:'+ uniqueId + ' - Error message is empty', JSON.stringify(error));
      return createResponse(res, 'INTERNAL_ERROR', JSON.stringify(errorMsg));
    }

    return createResponse(res, 'INTERNAL_ERROR', returnErrorMsg);
  }
});

async function settlement(dapp, receipt) {
  if (process.env.NETWORK === 'mainnet') {
    if (dapp) {
      const gasPriceValue = receipt?.gasPrice ?? receipt?.effectiveGasPrice;
      if (receipt?.gasUsed !== undefined && gasPriceValue !== undefined) {
        const gasUsed = typeof receipt.gasUsed === 'bigint' ? receipt.gasUsed : BigInt(receipt.gasUsed);
        const gasPrice = typeof gasPriceValue === 'bigint' ? gasPriceValue : BigInt(gasPriceValue);
        const usedFee = gasUsed * gasPrice;
        await updateDappWithFee(dapp, usedFee);

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
      } else {
        throw new Error('field missing in receipt:' + JSON.stringify(receipt));
      }
    } else {
      throw new Error('Settlement failed');
    }
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