import { NextRequest } from "next/server";
import { Wallet, parseTransaction } from "@kaiachain/ethers-ext/v6";
import { createResponse } from "@/lib/apiUtils";
import { prisma } from "@/lib/prisma";
import { DApp } from "@prisma/client";
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
      // balance check
      dapp = await getDappfromContract(targetContract as string);
      if (!dapp) {
        dapp = await getDappfromSender(sender as string);
        if (!dapp) {
          return createResponse("BAD_REQUEST", "Contract not found");
        }
      }
      if (!isEnoughBalance(BigInt(dapp.balance))) {
        return createResponse("BAD_REQUEST", "Insufficient balance");
      }
    }

    const provider = pickProviderFromPool();
    const feePayer = new Wallet(
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

const isWhitelistedContract = async (address: string) => {
  const contract = await prisma.contract.findUnique({
    where: { address },
  });
  return contract ? false : true;
};

const isWhitelistedSender = async (address: string) => {
  const sender = await prisma.sender.findUnique({
    where: { address },
  });
  return sender ? false : true;
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

const getDappfromSender = async (address: string) => {
  const sender = await prisma.sender.findUnique({
    where: { address },
  });
  const dapp = await prisma.dApp.findUnique({
    where: { id: sender?.dappId },
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
