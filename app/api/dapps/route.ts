import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createResponse, formattedBalance } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";

type Dapp = {
  name?: string;
  url?: string;
  balance?: number;
  contracts?: Contracts[];
};

type Contracts = {
  address: string;
};

export async function GET() {
  try {
    const dapps = await prisma.dApp.findMany({
      include: {
        contracts: true,
      },
    });

    const formattedDapps = dapps.map((dapp) => ({
      ...dapp,
      totalUsed: formattedBalance(dapp.totalUsed),
      balance: formattedBalance(dapp.balance),
    }));

    return NextResponse.json(formattedDapps);
  } catch (error) {
    console.error("Error fetching dapps:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch dapps");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("INTERNAL_ERROR", "Unauthorized");
    }

    const { name, url, balance, contracts } = await req.json();

    const data: any = {
      name,
      url,
      contracts: {
        create: contracts,
      },
    };

    if (
      !verifyDapp({
        name,
        url,
        balance,
        contracts,
      })
    ) {
      return createResponse("BAD_REQUEST", "Invalid dapp data");
    }

    if (balance) {
      const balanceInt = BigInt(balance) * BigInt(10 ** 18);
      data.balance = balanceInt.toString();
    }

    const dapp = await prisma.dApp.create({
      data,
    });

    return NextResponse.json(dapp);
  } catch (error) {
    console.error("Error creating dapp:", JSON.stringify(error));
    return createResponse("INTERNAL_ERROR", "Failed to create dapp");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("INTERNAL_ERROR", "Unauthorized");
    }

    const { id, url, balance } = await req.json();

    const updateData: any = {
      id,
    };

    if (url) {
      updateData.url = url;
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

    return NextResponse.json({
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
      return createResponse("INTERNAL_ERROR", "Unauthorized");
    }

    const { id } = await req.json();

    await prisma.dApp.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ message: "Dapp deleted" });
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
  return true;
};

const isValidHttpUrl = (urlStr: string) => {
  try {
    new URL(urlStr);
  } catch (_) {
    return false;
  }
  return true;
};
