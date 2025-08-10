const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { Wallet, parseTransaction } = require('@kaiachain/ethers-ext/v6');
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
router.options('/', async (_req, res) => {
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
  try {
    const { userSignedTx } = req.body || {};

    // Extract authorization token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const apiKey = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!userSignedTx || userSignedTx.raw === undefined) {
      return createResponse(res, 'BAD_REQUEST', 'userSignedTx is required, [format] -- { userSignedTx: { raw: user signed rlp encoded transaction } }');
    }

    const userSignedTxRlp = userSignedTx.raw;
    let tx;
    try {
      tx = parseTransaction(userSignedTxRlp);
    } catch (e) {
      console.error('Tx Parsing Error: ' + JSON.stringify(e));
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
          return createResponse(res, 'BAD_REQUEST', 'Dapp not configured. Please contact the administrator.');
        }

        if (Array.isArray(dapp.contracts) && dapp.contracts.length > 0 || Array.isArray(dapp.senders) && dapp.senders.length > 0) {
          const isContractWhitelisted = (dapp.contracts || []).some((contract) => contract.address === targetContract);
          const isSenderWhitelisted = (dapp.senders || []).some((_sender) => _sender.address === sender);

          if (!isContractWhitelisted && !isSenderWhitelisted) {
            return createResponse(res, 'BAD_REQUEST', 'Contract or sender address are not whitelisted');
          }
        }
      } else {
        // If no API key, fall back to contract/sender validation
        const { isWhitelisted, dapp: foundDapp } = await checkWhitelistedAndGetDapp(targetContract, sender);

        if (!isWhitelisted) {
          return createResponse(res, 'BAD_REQUEST', 'Contract or sender address are not whitelisted');
        }

        tx.feePayer = process.env.ACCOUNT_ADDRESS || '';
        dapp = foundDapp;

        if (!dapp) {
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
        return createResponse(res, 'BAD_REQUEST', 'Swap token address is not whitelisted');
      }

      // Check if DApp is active
      if (!dapp?.active) {
        return createResponse(res, 'BAD_REQUEST', 'DApp is inactive. Please contact the administrator to activate the DApp.');
      }

      if (!isEnoughBalance(BigInt(dapp.balance || '0'))) {
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
    do {
      try {
        txHash = await provider.send('klay_sendRawTransaction', [feePayerSignedTx]);
        if (txHash) break;
      } catch (e) {
        console.log(e);
        errorMessage = e?.error?.message || e?.message || e;
        console.error('[' + sendCnt + ' try]' + 'Transaction send failed: sender - ' + sender + ', contract - ' + targetContract);
      }
      sendCnt++;
    } while (sendCnt < 5);

    if (!txHash) {
      return createResponse(res, 'INTERNAL_ERROR', 'Sending transaction was failed after 5 try, network is busy. Error message: ' + errorMessage);
    }

    let receipt;
    let waitCnt = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('waiting for receipt', waitCnt);
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          break;
        }
      } catch (e) {
        console.error('Error getting transaction receipt for txHash: ' + txHash + ' : ' + JSON.stringify(e));
      }

      waitCnt++;
    } while (waitCnt < 15);

    if (!receipt) {
      return createResponse(res, 'INTERNAL_ERROR', 'Transaction was failed');
    }

    try {
      await settlement(dapp, receipt);
    } catch (error) {
      console.error(JSON.stringify(error));
      return createResponse(res, 'INTERNAL_ERROR', JSON.stringify(error));
    }

    if (receipt.status === 0) {
      console.error('[REVERTED] Transaction hash: ', txHash);
      return createResponse(res, 'REVERTED', receipt);
    }

    console.info('[SUCCESS] Transaction hash: ', txHash);
    return createResponse(res, 'SUCCESS', receipt);
  } catch (error) {
    const errorMsg = JSON.parse(JSON.stringify(error));
    console.error(JSON.stringify(errorMsg));

    const returnErrorMsg = (errorMsg && errorMsg.error && errorMsg.error.message) || errorMsg?.shortMessage;
    if (!returnErrorMsg) {
      console.error('Error message is empty', JSON.stringify(error));
      return createResponse(res, 'INTERNAL_ERROR', JSON.stringify(errorMsg));
    }

    return createResponse(res, 'INTERNAL_ERROR', returnErrorMsg);
  }
});

async function settlement(dapp, receipt) {
  if (process.env.NETWORK === 'mainnet') {
    if (dapp) {
      if (receipt?.gasUsed !== undefined && receipt?.gasPrice !== undefined) {
        const gasUsed = typeof receipt.gasUsed === 'bigint' ? receipt.gasUsed : BigInt(receipt.gasUsed);
        const gasPrice = typeof receipt.gasPrice === 'bigint' ? receipt.gasPrice : BigInt(receipt.gasPrice);
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
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.FROM_EMAIL || user;

    if (!host || !user || !pass) {
      console.warn('SMTP not configured; skipping email send');
      return { success: false, error: 'SMTP not configured' };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const subject = `Fee Delegation Alert - ${dappName} balance below threshold`;
    const text = `DApp: ${dappName}\nNew Balance (wei): ${newBalance}\nThreshold (wei): ${threshold}`;
    const html = `<p><strong>DApp:</strong> ${dappName}</p>
                  <p><strong>New Balance (wei):</strong> ${newBalance}</p>
                  <p><strong>Threshold (wei):</strong> ${threshold}</p>`;

    await transporter.sendMail({ from, to: email, subject, text, html });
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

module.exports = router; 