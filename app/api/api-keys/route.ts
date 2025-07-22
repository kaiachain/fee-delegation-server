import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResponse } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";
import { ethers } from "ethers";

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage API keys");
    }

    const { dappId, name } = await req.json();

    if (!dappId || !name) {
      return createResponse(
        "BAD_REQUEST",
        "Missing required fields: dappId, name"
      );
    }

    // Generate a random API key
    const key = `kaia_${ethers.hexlify(ethers.randomBytes(32))}`;

    // Check if DApp exists
    const dapp = await prisma.dApp.findUnique({
      where: { id: dappId },
      include: {
        contracts: true,
        senders: true
      }
    });

    if (!dapp) {
      return createResponse("NOT_FOUND", "DApp not found");
    }

    // Note: API keys and transaction filters can now coexist
    // No validation needed here

    const newApiKey = await prisma.apiKey.create({
      data: {
        key,
        name,
        dappId,
      },
      select: {
        id: true,
        key: true,
        name: true,
        dappId: true,
        createdAt: true
      }
    });

    return createResponse("SUCCESS", newApiKey);
  } catch (error) {
    console.error("Error adding API key:", error);
    return createResponse("INTERNAL_ERROR", "Failed to add API key");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage API keys");
    }

    const { id } = await req.json();

    if (!id) {
      return createResponse("BAD_REQUEST", "Missing required field: id");
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      include: {
        dapp: {
          include: {
            contracts: true,
            senders: true
          }
        }
      }
    });

    if (!apiKey) {
      return createResponse("NOT_FOUND", "API key not found");
    }

    // Note: API keys and transaction filters can now coexist
    // No validation needed here

    await prisma.apiKey.update({
      where: { id },
      data: {
        active: false,
      },
    });

    return createResponse("SUCCESS", { message: "API key deleted successfully" });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return createResponse("INTERNAL_ERROR", "Failed to delete API key");
  }
} 