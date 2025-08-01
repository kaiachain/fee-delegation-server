import { NextRequest } from "next/server";
import { isEnoughBalance } from "@/lib/apiUtils";
import { createResponse, checkWhitelistedAndGetDapp } from "@/lib/apiUtils";
import { getDappByApiKey } from "@/lib/dappUtils";
import { ethers } from "ethers";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const address = searchParams.get("address");

    // Extract authorization token
    const authHeader = req.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;
    
    if(!apiKey && !address) {
      return createResponse("BAD_REQUEST", "Invalid Input");
    }

    if (address && !ethers.isAddress(address)) {
      return createResponse("BAD_REQUEST", "Invalid address");
    }

    let dapp;
    let balance: string | null = null;

    // Check if API key is present and valid
    if (apiKey) {
      dapp = await getDappByApiKey(apiKey?.toLowerCase() || "");
      if (!dapp) {
        return createResponse("BAD_REQUEST", "Invalid API key");
      }
      
      balance = dapp.balance;
    } else {
      // If no API key, fall back to contract/sender validation for non-API key DApps
      if (!address) {
        return createResponse("BAD_REQUEST", "Address is required");
      }
      const { isWhitelisted, dapp: foundDapp } = await checkWhitelistedAndGetDapp(address.toLowerCase(), address.toLowerCase());

      if (!isWhitelisted) {
        return createResponse("BAD_REQUEST", "Address not whitelisted");
      }
      
      if (!foundDapp) {
        return createResponse("NOT_FOUND", "DApp not found");
      }
      
      dapp = foundDapp;
      balance = dapp.balance;
    }

    if (!balance) {
      return createResponse("NOT_FOUND", "Balance not found");
    }

    const hasEnoughBalance = isEnoughBalance(BigInt(balance));
    return createResponse("SUCCESS", hasEnoughBalance);
  } catch (error) {
    console.error("Balance check error:", error);
    return createResponse("INTERNAL_ERROR", "Failed to check balance");
  }
}