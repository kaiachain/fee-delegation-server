import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createResponse, checkDappHasApiKeys, checkSenderExistsForNoApiKeyDapps, checkSenderExistsForApiKeyDapps } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage senders");
    }

    const { dappId, address } = await req.json();

    if (!dappId || !address) {
      return createResponse(
        "BAD_REQUEST",
        "Missing required fields: dappId, address"
      );
    }

    if (ethers.isAddress(address) === false) {
      return createResponse("BAD_REQUEST", "Invalid address");
    }

    // Check if the DApp has API keys
    const dappHasApiKeys = await checkDappHasApiKeys(dappId);
    
    if (dappHasApiKeys) {
      // For DApps with API keys: check if sender exists in any DApp with API keys
      const existingSender = await checkSenderExistsForApiKeyDapps(address);
      if (existingSender) {
        return createResponse("BAD_REQUEST", "Sender already exists in a DApp with API keys");
      }
    } else {
      // For DApps without API keys: check if sender exists in any DApp without API keys
      const existingSender = await checkSenderExistsForNoApiKeyDapps(address);
      if (existingSender) {
        return createResponse("BAD_REQUEST", "Sender already exists in a DApp without API keys");
      }
    }

    const newSender = await prisma.sender.create({
      data: {
        address: address.toLowerCase(),
        dappId,
        active: true,
      },
    });

    return createResponse("SUCCESS", newSender);
  } catch (error) {
    console.error("Error adding sender:", error);
    return createResponse("INTERNAL_ERROR", "Failed to add sender");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage senders");
    }

    const { id } = await req.json();

    if (!id) {
      return createResponse("BAD_REQUEST", "Missing required field: id");
    }

    const sender = await prisma.sender.findFirst({
      where: {
        id,
      },
    });

    if (!sender) {
      return createResponse("NOT_FOUND", "Sender not found");
    }

    const updatedSender = await prisma.sender.update({
      where: {
        id,
      },
      data: {
        active: false,
      },
    });

    return createResponse("SUCCESS", updatedSender);
  } catch (error) {
    console.error("Error deactivating sender:", error);
    return createResponse("INTERNAL_ERROR", "Failed to deactivate sender");
  }
}
