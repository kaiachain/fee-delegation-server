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
      return createResponse("UNAUTHORIZED", "You don't have permission to check senders");
    }

    const { address } = await req.json();

    if (!address || !ethers.isAddress(address)) {
      return createResponse("BAD_REQUEST", "Invalid sender address");
    }

    // Check if sender exists
    const existingSender = await prisma.sender.findUnique({
      where: {
        address: address.toLowerCase()
      }
    });

    return createResponse("SUCCESS", !!existingSender);
  } catch (error) {
    console.error("Error checking sender:", error);
    return createResponse("INTERNAL_ERROR", "Failed to check sender");
  }
} 