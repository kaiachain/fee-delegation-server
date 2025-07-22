import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createResponse, checkDappHasApiKeys, checkContractExistsForNoApiKeyDapps, checkContractExistsForApiKeyDapps } from "@/lib/apiUtils";
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

    // Check if the DApp has API keys
    const dappHasApiKeys = await checkDappHasApiKeys(dappId);
    
    if (dappHasApiKeys) {
      // For DApps with API keys: check if contract exists in any DApp with API keys
      const existingContract = await checkContractExistsForApiKeyDapps(address);
      if (existingContract) {
        return createResponse("BAD_REQUEST", "Contract already exists in a DApp with API keys");
      }
    } else {
      // For DApps without API keys: check if contract exists in any DApp without API keys
      const existingContract = await checkContractExistsForNoApiKeyDapps(address);
      if (existingContract) {
        return createResponse("BAD_REQUEST", "Contract already exists in a DApp without API keys");
      }
    }

    const newContract = await prisma.contract.create({
      data: {
        address: address.toLowerCase(),
        dappId,
        hasSwap: hasSwap || false,
        swapAddress: hasSwap ? swapAddress.toLowerCase() : null,
        active: true,
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

    const contract = await prisma.contract.update({
      where: {
        id,
      },
      data: {
        active: false,
      },
    });

    return createResponse("SUCCESS", contract);
  } catch (error) {
    console.error("Error deactivating contract:", error);
    return createResponse("INTERNAL_ERROR", "Failed to deactivate contract");
  }
}
