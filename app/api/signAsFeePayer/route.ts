import { NextRequest } from "next/server";
import {
  Wallet,
  parseTransaction,
  JsonRpcProvider,
} from "@kaiachain/ethers-ext/v6";
import { createResponse } from "@/lib/apiUtils";
import { prisma } from "@/lib/prisma";
import { DApp } from "@prisma/client";

const provider = new JsonRpcProvider(process.env.RPC_URL as string);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userSignedTx } = body;

    if (!userSignedTx) {
      return createResponse("BAD_REQUEST", "userSignedTx is required");
    }

    const userSignedTxRlp = userSignedTx.raw;
    const tx = parseTransaction(userSignedTxRlp);

    const targetContract = tx.to?.toLowerCase();
    console.log(targetContract);
    if (await isWhitelisted(targetContract as string)) {
      return createResponse("BAD_REQUEST", "Contract is not whitelisted");
    }

    // balance check
    const dapp = await getDappfromContract(targetContract as string);
    if (!dapp) {
      return createResponse("BAD_REQUEST", "Contract not found");
    }
    if (!isEnoughBalance(BigInt(dapp.balance))) {
      return createResponse("BAD_REQUEST", "Insufficient balance");
    }

    const feePayer = new Wallet(
      process.env.FEE_PAYER_PRIVATE_KEY as string,
      provider
    );

    const txHash = await feePayer.sendTransactionAsFeePayer(tx);
    const receipt = await txHash.wait();

    // update balance, totalUsed
    console.log(receipt);
    if (receipt?.gasUsed !== undefined && receipt?.gasPrice !== undefined) {
      const usedFee = receipt?.gasUsed * BigInt(receipt?.gasPrice);
      await updateDappWithFee(dapp, usedFee);
    }

    if (receipt?.status !== 1) {
      return createResponse("BAD_REQUEST", "Transaction failed");
    }
    return createResponse("SUCCESS", receipt);
  } catch (error) {
    console.log(JSON.stringify(error));
    return createResponse("INTERNAL_ERROR", "An unexpected error occurred");
  }
}

const isWhitelisted = async (address: string) => {
  const contract = await prisma.contract.findUnique({
    where: { address },
  });
  return contract ? false : true;
};

const getDappfromContract = async (address: string) => {
  const contract = await prisma.contract.findUnique({
    where: { address },
  });
  const dapp = await prisma.dApp.findUnique({
    where: { id: contract?.dappId },
  });
  return dapp;
};

const isEnoughBalance = (balance: bigint) => {
  return balance > 0.1 ? true : false;
};

const updateDappWithFee = async (dapp: DApp, fee: bigint) => {
  const balance = BigInt(dapp?.balance) - fee;
  const totalUsed = BigInt(dapp?.totalUsed) + fee;
  await prisma.dApp.update({
    where: { id: dapp.id },
    data: { balance: balance.toString(), totalUsed: totalUsed.toString() },
  });
};
