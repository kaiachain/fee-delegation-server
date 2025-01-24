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

    if (!userSignedTx || userSignedTx.raw === undefined) {
      return createResponse(
        "BAD_REQUEST",
        "userSignedTx is required, [format] -- { userSignedTx: { raw: user signed rlp encoded transaction } }"
      );
    }

    const userSignedTxRlp = userSignedTx.raw;
    const tx = parseTransaction(userSignedTxRlp);

    // if it's testnet, allow all transactions
    let dapp;
    const targetContract = tx.to?.toLowerCase() as string;
    const sender = tx.from?.toLowerCase() as string;
    if (process.env.NETWORK === "mainnet") {
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
        if (!dapp && !sender) {
          dapp = await getDappfromSender(sender as string);
        } else {
          return createResponse("BAD_REQUEST", "Address not found");
        }
      }

      if (dapp && !isEnoughBalance(BigInt(dapp.balance))) {
        return createResponse(
          "BAD_REQUEST",
          "Insufficient balance in fee delegation server, please contact us"
        );
      }
    }
    const provider = pickProviderFromPool();
    const feePayer = new Wallet(
      process.env.ACCOUNT_ADDRESS as string,
      process.env.FEE_PAYER_PRIVATE_KEY as string,
      provider
    );

    const txResp = await feePayer.sendTransactionAsFeePayer(tx);
    let cnt = 0;
    let receipt;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("waiting for receipt", cnt);
      receipt = await provider.getTransactionReceipt(txResp.hash);
      if (receipt) {
        break;
      }
      cnt++;
    } while (cnt < 40);

    if (!receipt) {
      return createResponse("INTERNAL_ERROR", "Transaction failed");
    }

    try {
      await settlement(targetContract, sender, receipt);
    } catch (error) {
      console.error(JSON.stringify(error));
      return createResponse("INTERNAL_ERROR", JSON.stringify(error));
    }

    return createResponse("SUCCESS", receipt);
  } catch (error) {
    const errorMsg = JSON.parse(JSON.stringify(error));
    console.error(errorMsg);
    if (errorMsg?.error?.message === "")
      return createResponse("INTERNAL_ERROR", "An unexpected error occurred");

    return createResponse("INTERNAL_ERROR", errorMsg?.error?.message);
  }
}

const settlement = async (
  contractAddress: string,
  senderAddress: string,
  receipt: any
) => {
  let dapp;
  console.log(contractAddress, senderAddress);
  if (process.env.NETWORK === "mainnet") {
    if (contractAddress) {
      dapp = await getDappfromContract(contractAddress as string);
    }
    if (!dapp && senderAddress) {
      dapp = await getDappfromSender(senderAddress as string);
    }
    if (dapp) {
      console.log(receipt);
      if (receipt?.gasUsed !== undefined && receipt?.gasPrice !== undefined) {
        const usedFee = BigInt(receipt?.gasUsed) * BigInt(receipt?.gasPrice);
        await updateDappWithFee(dapp, usedFee);
      }
    } else {
      throw new Error("Settlement failed");
    }
  }
};
