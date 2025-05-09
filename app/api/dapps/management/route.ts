import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResponse, formattedBalance } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";

export async function GET(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to access management data");
    }

    const dapps = await prisma.dApp.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        balance: true,
        totalUsed: true,
        active: true,
        createdAt: true,
        terminationDate: true,
        contracts: {
          select: {
            id: true,
            address: true,
            hasSwap: true,
            swapAddress: true,
            createdAt: true
          }
        },
        senders: {
          select: {
            id: true,
            address: true
          }
        }
      }
    });

    const formattedDapps = dapps.map((dapp) => ({
      ...dapp,
      totalUsed: formattedBalance(dapp.totalUsed),
      balance: formattedBalance(dapp.balance),
    }));

    return createResponse("SUCCESS", formattedDapps);
  } catch (error) {
    console.error("Error fetching dapps for management:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch dapps");
  }
} 