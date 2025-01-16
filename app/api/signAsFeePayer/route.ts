import { NextRequest } from "next/server";
import { Wallet, parseTransaction } from "@kaiachain/ethers-ext/v6";
import { createResponse } from "@/lib/apiUtils";
import {
  isWhitelistedContract,
  isWhitelistedSender,
  getDappfromContract,
  getDappfromSender,
  isEnoughBalance,
  updateDappWithFee,
} from "@/lib/apiUtils";
import pickProviderFromPool from "@/lib/rpcProvider";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userSignedTx } = body;

    if (!userSignedTx) {
      return createResponse("BAD_REQUEST", "userSignedTx is required");
    }

    const userSignedTxRlp = userSignedTx.raw;
    const tx = parseTransaction(userSignedTxRlp);

    // if it's testnet, allow all transactions
    let dapp;
    if (process.env.NETWORK === "mainnet") {
      const targetContract = tx.to?.toLowerCase() as string;
      const sender = tx.from?.toLowerCase() as string;
      if (
        !(
          (await isWhitelistedContract(targetContract)) ||
          (await isWhitelistedSender(sender))
        )
      ) {
        return createResponse("BAD_REQUEST", "Contract is not whitelisted");
      }
      tx.feePayer = process.env.ACCOUNT_ADDRESS as string;

      // balance check
      if (!targetContract) {
        dapp = await getDappfromContract(targetContract as string);
        console.log(1);
        if (!dapp && !sender) {
          dapp = await getDappfromSender(sender as string);
          console.log(2);
        } else {
          return createResponse("BAD_REQUEST", "Address not found");
        }
      }

      if (dapp && !isEnoughBalance(BigInt(dapp.balance))) {
        return createResponse("BAD_REQUEST", "Insufficient balance");
      }
    }

    const provider = pickProviderFromPool();
    const feePayer = new Wallet(
      process.env.ACCOUNT_ADDRESS as string,
      process.env.FEE_PAYER_PRIVATE_KEY as string,
      provider
    );

    const txHash = await feePayer.sendTransactionAsFeePayer(tx);
    const receipt = await txHash.wait();

    // update balance, totalUsed
    if (process.env.NETWORK === "mainnet" && dapp) {
      if (receipt?.gasUsed !== undefined && receipt?.gasPrice !== undefined) {
        const usedFee = receipt?.gasUsed * BigInt(receipt?.gasPrice);
        await updateDappWithFee(dapp, usedFee);
      }
    }

    if (receipt?.status !== 1) {
      return createResponse("BAD_REQUEST", receipt);
    }
    return createResponse("SUCCESS", receipt);
  } catch (error) {
    console.log(JSON.stringify(error));
    const msg = JSON.parse(JSON.stringify(error))?.error?.message || "";
    if (msg === "")
      return createResponse("INTERNAL_ERROR", "An unexpected error occurred");
    return createResponse("INTERNAL_ERROR", msg);
  }
}
