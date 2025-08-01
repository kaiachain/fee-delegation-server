import { NextRequest } from "next/server";
import { isEnoughBalance } from "@/lib/apiUtils";
import { createResponse } from "@/lib/apiUtils";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const address = searchParams.get("address");

    if (!ethers.isAddress(address)) {
      return createResponse("BAD_REQUEST", "Invalid address");
    }

    let balance;
    const contract = await prisma.contract.findUnique({
      where: { address },
    });
    if (!contract) {
      const sender = await prisma.sender.findUnique({
        where: { address },
      });
      if (!sender) {
        return createResponse("NOT_FOUND", "Address not found");
      }
      const dapp = await prisma.dApp.findUnique({
        select: { balance: true },
        where: { id: sender.dappId },
      });
      balance = dapp?.balance as string;
    } else {
      const dapp = await prisma.dApp.findUnique({
        select: { balance: true },
        where: { id: contract.dappId },
      });
      balance = dapp?.balance as string;
    }
    if (isEnoughBalance(BigInt(balance))) {
      return createResponse("SUCCESS", true);
    } else {
      return createResponse("SUCCESS", false);
    }
  } catch (error) {
    return createResponse("INTERNAL_ERROR", JSON.stringify(error));
  }
}