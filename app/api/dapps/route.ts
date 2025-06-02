import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createResponse, formattedBalance } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";
import { Dapp, Contract, Sender, ApiKey } from "@/app/types/index";

export async function GET() {
  try {
    const dapps = await prisma.dApp.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        balance: true,
        totalUsed: true,
        createdAt: true
      },
      where: {
        active: true
      }
    });
    const formattedDapps = dapps.map((dapp: any) => ({
      ...dapp,
      totalUsed: formattedBalance(dapp.totalUsed),
      balance: formattedBalance(dapp.balance),
    }));

    return createResponse("SUCCESS", formattedDapps);
  } catch (error) {
    console.error("Error fetching dapps:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch dapps");
  }
}

type CreateDAppData = {
  name: string;
  url: string;
  active: boolean;
  balance: string;
  totalUsed: string;
  terminationDate?: string;
  contracts: {
    create: Array<{
      address: string;
      hasSwap: boolean;
      swapAddress: string | null;
    }>;
  };
  senders: {
    create: Array<{
      address: string;
    }>;
  };
  apiKeys: {
    create: Array<{
      key: string;
      name: string;
    }>;
  };
};

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to create DApps");
    }

    const { name, url, balance, terminationDate, contracts, senders, apiKeys } = await req.json();

    // Validate required fields
    if (!name || !url) {
      return createResponse("BAD_REQUEST", "Name and URL are required");
    }

    // Validate arrays
    if (!Array.isArray(contracts) || !Array.isArray(senders) || !Array.isArray(apiKeys)) {
      return createResponse("BAD_REQUEST", "Contracts, senders, and apiKeys must be arrays");
    }

    // Prepare data with proper types
    const data: CreateDAppData = {
      name,
      url,
      active: true,
      balance: "0",
      totalUsed: "0",
      contracts: {
        create: contracts.map((contract: Contract) => ({
          address: contract.address,
          hasSwap: contract.hasSwap || false,
          swapAddress: contract.swapAddress || null,
        })),
      },
      senders: {
        create: senders.map((sender: Sender) => ({
          address: sender.address,
        })),
      },
      apiKeys: {
        create: apiKeys.map((apiKey: ApiKey) => ({
          key: apiKey.key,
          name: apiKey.name,
        })),
      },
    };

    // Validate DApp data
    if (!verifyDapp({
      name,
      url,
      balance,
      terminationDate,
      contracts,
      senders,
      apiKeys,
    })) {
      return createResponse("BAD_REQUEST", "Invalid DApp data. Please check all fields.");
    }

    // Handle balance
    try {
      if (balance) {
        const balanceNum = Number(balance);
        if (isNaN(balanceNum) || balanceNum < 0) {
          return createResponse("BAD_REQUEST", "Invalid balance amount");
        }
        const balanceInt = BigInt(balanceNum) * BigInt(10 ** 18);
        data.balance = balanceInt.toString();
      }
    } catch (error) {
      return createResponse("BAD_REQUEST", "Invalid balance format");
    }

    // Add termination date if provided
    if (terminationDate) {
      try {
        new Date(terminationDate); // Validate date format
        data.terminationDate = terminationDate;
      } catch (error) {
        return createResponse("BAD_REQUEST", "Invalid termination date format");
      }
    }

    // Create DApp with error handling
    try {
      const dapp = await prisma.dApp.create({
        data,
        include: {
          contracts: true,
          senders: true,
          apiKeys: true,
        },
      });

      return createResponse("SUCCESS", {
        ...dapp,
        balance: ethers.formatUnits(dapp.balance),
        totalUsed: ethers.formatUnits(dapp.totalUsed),
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return createResponse("CONFLICT", "A DApp with this name or address combination already exists");
      }
      throw error; // Re-throw for general error handling
    }
  } catch (error) {
    console.error("Error creating dapp:", error);
    if (error instanceof Error) {
      return createResponse("INTERNAL_ERROR", `Failed to create dapp: ${error.message}`);
    }
    return createResponse("INTERNAL_ERROR", "Failed to create dapp");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage DApps");
    }

    const { id, url, balance, terminationDate, active } = await req.json();

    const updateData: any = {
      id,
    };

    if (url) {
      updateData.url = url;
    }

    if (terminationDate) {
      updateData.terminationDate = terminationDate;
    }

    if (typeof active === "boolean") {
      updateData.active = active;
    }

    if (balance) {
      const curBalance = await prisma.dApp.findUnique({
        where: {
          id,
        },
        select: {
          balance: true,
        },
      });
      const newBalance =
        BigInt(curBalance?.balance as string) +
        BigInt(balance) * BigInt(10 ** 18);
      updateData.balance = newBalance.toString();
    }

    const dataToVerify = updateData as Dapp;
    if (!verifyDapp(dataToVerify)) {
      return createResponse("BAD_REQUEST", "Invalid dapp data");
    }

    const dapp = await prisma.dApp.update({
      where: {
        id,
      },
      data: updateData,
    });

    return createResponse("SUCCESS", {
      ...dapp,
      balance: ethers.formatUnits(dapp.balance),
    });
  } catch (error) {
    console.error("Error updating dapp:", JSON.stringify(error));
    return createResponse("INTERNAL_ERROR", "Failed to update dapp");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage DApps");
    }

    const { id } = await req.json();

    await prisma.dApp.delete({
      where: {
        id,
      },
    });

    return createResponse("SUCCESS", { message: "Dapp deleted" });
  } catch (error) {
    console.error("Error deleting dapp:", JSON.stringify(error));
    return createResponse("INTERNAL_ERROR", "Failed to delete dapp");
  }
}

const verifyDapp = (dapp: Dapp) => {
  if ("totalUsed" in dapp || "createdAt" in dapp) {
    return false;
  }
  if (dapp.url && !isValidHttpUrl(dapp.url)) {
    return false;
  }
  if (dapp.balance && BigInt(dapp.balance) < 0) {
    return false;
  }
  if (
    dapp.contracts &&
    dapp.contracts.length !== 0 &&
    !dapp.contracts.every((contract) => ethers.isAddress(contract.address))
  ) {
    return false;
  }
  if (
    dapp.contracts &&
    dapp.contracts.some(
      (contract) =>
        contract.hasSwap &&
        (!contract.swapAddress || !ethers.isAddress(contract.swapAddress))
    )
  ) {
    return false;
  }
  if (
    dapp.senders &&
    dapp.senders.length !== 0 &&
    !dapp.senders.every((sender) => ethers.isAddress(sender.address))
  ) {
    return false;
  }
  if (
    dapp.apiKeys &&
    dapp.apiKeys.length !== 0 &&
    !dapp.apiKeys.every((apiKey) => apiKey.key && apiKey.name)
  ) {
    return false;
  }
  return true;
};

const isValidHttpUrl = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};
