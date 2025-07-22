import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResponse, formattedBalance } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";
import { ethers } from "ethers";

export async function GET(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to access management data");
    }

    const dapps = await (prisma.dApp as any).findMany({
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
            active: true,
            createdAt: true
          }
        },
        senders: {
          select: {
            id: true,
            address: true,
            active: true
          }
        },
        apiKeys: {
          select: {
            id: true,
            key: true,
            name: true,
            createdAt: true
          }
        },
        emailAlerts: {
          select: {
            id: true,
            email: true,
            balanceThreshold: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    const formattedDapps = dapps.map((dapp: any) => {
      // Calculate active and inactive counts
      const activeContracts = dapp.contracts.filter((contract: any) => contract.active !== false);
      const inactiveContracts = dapp.contracts.filter((contract: any) => contract.active === false);
      const activeSenders = dapp.senders.filter((sender: any) => sender.active !== false);
      const inactiveSenders = dapp.senders.filter((sender: any) => sender.active === false);
      const activeApiKeys = dapp.apiKeys.filter((key: any) => key.active !== false);
      const inactiveApiKeys = dapp.apiKeys.filter((key: any) => key.active === false);

      return {
        ...dapp,
        totalUsed: formattedBalance(dapp.totalUsed),
        balance: formattedBalance(dapp.balance),
        emailAlerts: dapp.emailAlerts?.map((alert: any) => ({
          ...alert,
          balanceThreshold: ethers.formatUnits(alert.balanceThreshold, 18)
        })) || [],
        // Add summary statistics
        contractStats: {
          total: dapp.contracts.length,
          active: activeContracts.length,
          inactive: inactiveContracts.length
        },
        senderStats: {
          total: dapp.senders.length,
          active: activeSenders.length,
          inactive: inactiveSenders.length
        },
        apiKeyStats: {
          total: dapp.apiKeys.length,
          active: activeApiKeys.length,
          inactive: inactiveApiKeys.length
        }
      };
    });

    return createResponse("SUCCESS", formattedDapps);
  } catch (error) {
    console.error("Error fetching dapps for management:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch dapps");
  }
} 