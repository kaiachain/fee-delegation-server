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
      return createResponse("UNAUTHORIZED", "You don't have permission to check contracts");
    }

    const { address, hasSwap, swapAddress } = await req.json();

    if (!address || !ethers.isAddress(address)) {
      return createResponse("BAD_REQUEST", "Invalid contract address");
    }

    // Check if contract exists with the same address and swap configuration (only active contracts)
    const existingContract = await prisma.contract.findFirst({
      where: {
        address: address.toLowerCase(),
        hasSwap: hasSwap || false,
        swapAddress: hasSwap ? swapAddress?.toLowerCase() : null,
        active: true
      }
    });

    return createResponse("SUCCESS", !!existingContract);
  } catch (error) {
    console.error("Error checking contract:", error);
    return createResponse("INTERNAL_ERROR", "Failed to check contract");
  }
} 