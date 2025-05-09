import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createResponse } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage contracts");
    }

    const { dappId, address, hasSwap, swapAddress } = await req.json();

    if (!dappId || !address) {
      return createResponse(
        "BAD_REQUEST",
        "Missing required fields: dappId, address"
      );
    }

    if (ethers.isAddress(address) === false) {
      return createResponse("BAD_REQUEST", "Invalid address");
    }

    // Validate swap address if hasSwap is true
    if (hasSwap && (!swapAddress || !ethers.isAddress(swapAddress))) {
      return createResponse("BAD_REQUEST", "Invalid swap address");
    }

    if (
      await prisma.contract.findFirst({
        where: {
          address,
        },
      })
    ) {
      return createResponse("BAD_REQUEST", "Contract already exists");
    }

    const newContract = await prisma.contract.create({
      data: {
        address: address.toLowerCase(),
        dappId,
        hasSwap: hasSwap || false,
        swapAddress: hasSwap ? swapAddress.toLowerCase() : null,
      },
    });

    return createResponse("SUCCESS", newContract);
  } catch (error) {
    console.error("Error adding contract:", error);
    return createResponse("INTERNAL_ERROR", "Failed to add contract");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage contracts");
    }

    const { id } = await req.json();

    if (!id) {
      return createResponse("BAD_REQUEST", "Missing required fields: id");
    }

    const contract = await prisma.contract.delete({
      where: {
        id,
      },
    });

    return createResponse("SUCCESS", contract);
  } catch (error) {
    console.error("Error removing contract:", error);
    return createResponse("INTERNAL_ERROR", "Failed to remove contract");
  }
}
