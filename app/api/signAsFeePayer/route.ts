import { NextRequest } from "next/server";
import { Wallet, parseTransaction } from "@kaiachain/ethers-ext/v6";
import { createResponse } from "@/lib/apiUtils";
import {
  checkWhitelistedContract,
  checkWhitelistedSender,
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
    let tx: any;
    try {
      tx = parseTransaction(userSignedTxRlp);
    } catch (e) {
      console.error("Tx Parsing Error: " + JSON.stringify(e));
      return createResponse("BAD_REQUEST", "Failed to parse transaction");
    }

    // if it's testnet, allow all transactions
    const targetContract = tx.to?.toLowerCase() ?? "";
    const sender = tx.from?.toLowerCase() ?? "";
    if (process.env.NETWORK === "mainnet") {
      if (
        !(await checkWhitelistedContract(targetContract)) &&
        !(await checkWhitelistedSender(sender))
      ) {
        return createResponse(
          "BAD_REQUEST",
          "Contract or sender address are not whitelisted"
        );
      }
      tx.feePayer = process.env.ACCOUNT_ADDRESS as string;

      // balance check
      let dapp = null;
      if (targetContract) {
        dapp = await getDappfromContract(targetContract);
      }

      if (!dapp && sender) {
        dapp = await getDappfromSender(sender);
      }

      if (!dapp) {
        return createResponse("BAD_REQUEST", "Address not found");
      }

      if (!isEnoughBalance(BigInt(dapp.balance ?? 0))) {
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

    const feePayerSignedTx = await feePayer.signTransactionAsFeePayer(tx);
    let txHash;
    let sendCnt = 0;
    do {
      try {
        txHash = await provider.send("klay_sendRawTransaction", [
          feePayerSignedTx,
        ]);
        // const txResp = await feePayer.sendTransactionAsFeePayer(tx);
        if (txHash) break;
      } catch (e) {
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
        "Sending transaction was failed after 5 try, network is busy"
      );
    }

    let receipt;
    let waitCnt = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("waiting for receipt", waitCnt);
      // receipt = await provider.getTransactionReceipt(txResp.hash);
      receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        break;
      }
      waitCnt++;
    } while (waitCnt < 15);

    if (!receipt) {
      return createResponse("INTERNAL_ERROR", "Transaction was failed");
    }

    try {
      await settlement(targetContract, sender, receipt);
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

const settlement = async (
  contractAddress: string,
  senderAddress: string,
  receipt: any
) => {
  let dapp;
  if (process.env.NETWORK === "mainnet") {
    if (contractAddress) {
      dapp = await getDappfromContract(contractAddress as string);
    }
    if (!dapp && senderAddress) {
      dapp = await getDappfromSender(senderAddress as string);
    }
    if (dapp) {
      if (receipt?.gasUsed !== undefined && receipt?.gasPrice !== undefined) {
        const usedFee = BigInt(receipt?.gasUsed) * BigInt(receipt?.gasPrice);
        await updateDappWithFee(dapp, usedFee);
      } else {
        throw new Error("field missing in receipt:" + JSON.stringify(receipt));
      }
    } else {
      throw new Error("Settlement failed");
    }
  }
};
