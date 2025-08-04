import { NextRequest, NextResponse } from "next/server";
import { Wallet, parseTransaction } from "@kaiachain/ethers-ext/v6";
import { createResponse } from "@/lib/apiUtils";
import {
  checkWhitelistedAndGetDapp,
  isEnoughBalance,
  updateDappWithFee,
  validateSwapTransaction,
} from "@/lib/apiUtils";
import { getDappByApiKey } from "@/lib/dappUtils";
import pickProviderFromPool from "@/lib/rpcProvider";
import { DApp, Contract as PrismaContract } from "@prisma/client";
import { sendBalanceAlertEmail } from "@/lib/emailUtils";
import { prisma } from "@/lib/prisma";

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return createResponse("SUCCESS", {});
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userSignedTx } = body;

    // Extract authorization token
    const authHeader = req.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    if (!userSignedTx || userSignedTx.raw === undefined) {
      return createResponse(
        "BAD_REQUEST",
        "userSignedTx is required, [format] -- { userSignedTx: { raw: user signed rlp encoded transaction } }"
      );
    }

    const userSignedTxRlp = userSignedTx.raw;
    let tx: any;
    try {
      tx = parseTransaction(userSignedTxRlp);
    } catch (e) {
      console.error("Tx Parsing Error: " + JSON.stringify(e));
      return createResponse("BAD_REQUEST", "Failed to parse transaction");
    }

    let dapp;
    const targetContract = tx.to?.toLowerCase() ?? "";
    const sender = tx.from?.toLowerCase() ?? "";

    // if it's testnet, allow all transactions
    if (process.env.NETWORK === "mainnet") {
      console.log(JSON.stringify(tx));
      // First check if API key is present and valid
      if (apiKey) {
        dapp = await getDappByApiKey(apiKey);
        if (!dapp) {
          return createResponse("BAD_REQUEST", "Invalid API key");
        }
        // Check if Dapp has contracts or senders which are whitelisted
        if(dapp.contracts.length > 0 || dapp.senders.length > 0) {
          const isContractWhitelisted = dapp.contracts.some((contract) => contract.address === targetContract);
          const isSenderWhitelisted = dapp.senders.some((_sender) => _sender.address === sender);
          
          if(!isContractWhitelisted && !isSenderWhitelisted) {
            return createResponse(
              "BAD_REQUEST",
              "Contract or sender address are not whitelisted"
            );
          }
        }
      } else {
        // If no API key, fall back to contract/sender validation
        const { isWhitelisted, dapp: foundDapp } = await checkWhitelistedAndGetDapp(targetContract, sender);
        
        if (!isWhitelisted) {
          return createResponse(
            "BAD_REQUEST",
            "Contract or sender address are not whitelisted"
          );
        }
        
        tx.feePayer = process.env.ACCOUNT_ADDRESS as string;
        dapp = foundDapp;

        if (!dapp) {
          return createResponse("BAD_REQUEST", "Dapp not configured. Please contact the administrator.");
        }
      }

      // Transform the dapp data to match the expected type for validateSwapTransaction
      const dappWithContracts = {
        name: dapp.name,
        contracts: dapp.contracts.map(contract => ({
          hasSwap: contract.hasSwap,
          address: contract.address,
          swapAddress: contract.swapAddress || undefined
        }))
      };

      // Check if the transaction is a swap transaction
      const isValidSwap = await validateSwapTransaction(
        dappWithContracts,
        tx
      );
      if (!isValidSwap) {
        return createResponse(
          "BAD_REQUEST",
          "Swap token address is not whitelisted"
        );
      }

      // Check if DApp is active
      if (!dapp?.active) {
        return createResponse(
          "BAD_REQUEST",
          "DApp is inactive. Please contact the administrator to activate the DApp."
        );
      }

      if (!isEnoughBalance(BigInt(dapp.balance ?? 0))) {
        return createResponse(
          "BAD_REQUEST",
          "Insufficient balance in fee delegation server, please contact the administrator."
        );
      }

      // Check if the Dapp has a termination date
      if (dapp.terminationDate) {
        const terminationDate = new Date(dapp.terminationDate);
        const now = new Date();
        // Convert both dates to KST (UTC+9)
        const kstTerminationDate = new Date(
          terminationDate.getTime() + 9 * 60 * 60 * 1000
        );
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

        // Add one day to termination date to make it exclusive
        const nextDayAfterTermination = new Date(kstTerminationDate);
        nextDayAfterTermination.setDate(nextDayAfterTermination.getDate() + 1);

        if (kstNow >= nextDayAfterTermination) {
          return createResponse(
            "BAD_REQUEST",
            "DApp is terminated. Please contact the administrator to activate the DApp."
          );
        }
      }
    }

    const provider = pickProviderFromPool();
    const feePayer = new Wallet(
      process.env.ACCOUNT_ADDRESS as string,
      process.env.FEE_PAYER_PRIVATE_KEY as string,
      provider
    );

    const feePayerSignedTx = await feePayer.signTransactionAsFeePayer(tx);
    let txHash;
    let sendCnt = 0;
    let errorMessage = "";
    do {
      try {
        txHash = await provider.send("klay_sendRawTransaction", [
          feePayerSignedTx,
        ]);
        // const txResp = await feePayer.sendTransactionAsFeePayer(tx);
        if (txHash) break;
      } catch (e: any) {
        console.log(e);
        errorMessage = e?.error?.message || e?.message || "";
        console.error(
          "[" +
            sendCnt +
            " try]" +
            "Transaction send failed: sender - " +
            sender +
            ", contract - " +
            targetContract
        );
      }
      sendCnt++;
    } while (sendCnt < 5);

    if (!txHash) {
      return createResponse(
        "INTERNAL_ERROR",
        "Sending transaction was failed after 5 try, network is busy. Error message: " + errorMessage
      );
    }

    let receipt;
    let waitCnt = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("waiting for receipt", waitCnt);
      try {
        // receipt = await provider.getTransactionReceipt(txResp.hash);
        receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          break;
        }
      } catch (e) {
        console.error(
          "Error getting transaction receipt for txHash: " +
            txHash +
            " : " +
            JSON.stringify(e)
        );
      }

      waitCnt++;
    } while (waitCnt < 15);

    if (!receipt) {
      return createResponse("INTERNAL_ERROR", "Transaction was failed");
    }

    try {
      await settlement(dapp, receipt);
    } catch (error) {
      console.error(JSON.stringify(error));
      return createResponse("INTERNAL_ERROR", JSON.stringify(error));
    }

    if (receipt.status === 0) {
      // console.error("[REVERTED] Transaction hash: ", txResp.hash);
      console.error("[REVERTED] Transaction hash: ", txHash);
      return createResponse("REVERTED", receipt);
    }

    // console.info("[SUCCESS] Transaction hash: ", txResp.hash);
    console.info("[SUCCESS] Transaction hash: ", txHash);
    return createResponse("SUCCESS", receipt);
  } catch (error) {
    const errorMsg = JSON.parse(JSON.stringify(error));
    console.error(JSON.stringify(errorMsg));

    const returnErrorMsg = errorMsg?.error?.message || errorMsg?.shortMessage;
    if (returnErrorMsg === "") {
      console.error("Error message is empty", JSON.stringify(error));
      return createResponse("INTERNAL_ERROR", JSON.stringify(errorMsg));
    }

    return createResponse("INTERNAL_ERROR", returnErrorMsg);
  }
}

const settlement = async (dapp: any, receipt: any) => {
  if (process.env.NETWORK === "mainnet") {
    if (dapp) {
      if (receipt?.gasUsed !== undefined && receipt?.gasPrice !== undefined) {
        const usedFee = BigInt(receipt?.gasUsed) * BigInt(receipt?.gasPrice);
        await updateDappWithFee(dapp, usedFee);
        
        // Get updated DApp with email alerts
        const updatedDapp = await prisma.dApp.findUnique({
          where: { id: dapp.id },
          include: {
            emailAlerts: {
              where: { isActive: true }
            }
          }
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
                  threshold: threshold.toString()
                });
                
                if (emailResult.success) {
                  // Log the email alert
                  await prisma.emailAlertLog.create({
                    data: {
                      email: alert.email,
                      dappId: updatedDapp.id,
                      dappName: updatedDapp.name,
                      newBalance: newBalance.toString(),
                      threshold: threshold.toString()
                    }
                  });
                  
                  // Disable the alert after sending
                  await prisma.emailAlert.update({
                    where: { id: alert.id },
                    data: { isActive: false }
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
        throw new Error("field missing in receipt:" + JSON.stringify(receipt));
      }
    } else {
      throw new Error("Settlement failed");
    }
  }
};
