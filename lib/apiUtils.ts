import { NextResponse } from "next/server";
import { Session } from "next-auth";
import { ethers } from "ethers";
import { prisma } from "@/lib/prisma";
import { DApp } from "@prisma/client";
import { parseKaia } from "@kaiachain/ethers-ext/v6";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const RESPONSE_MAP: {
  [key: string]: { message: string; status: number };
} = {
  SUCCESS: { message: "Request was successful", status: 200 },
  REVERTED: { message: "Transaction reverted", status: 200 },
  BAD_REQUEST: { message: "Bad request", status: 400 },
  METHOD_NOT_ALLOWED: { message: "Method not allowed", status: 405 },
  INTERNAL_ERROR: { message: "Internal server error", status: 500 },
  NOT_FOUND: { message: "Resource not found", status: 404 },
  CONFLICT: { message: "Resource already exists", status: 409 },
  UNAUTHORIZED: { message: "Unauthorized access", status: 401 },
};

export const createResponse = (type: keyof typeof RESPONSE_MAP, data?: any) => {
  const { message, status } = RESPONSE_MAP[type];
  return NextResponse.json(
    {
      message,
      data,
      error: type !== "SUCCESS" ? type : undefined,
      status: type === "SUCCESS",
    },
    {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
};

export const fetchData = async (
  url: string,
  options: any = {},
  session: Session | null
) => {
  if (!session) {
    throw new Error("User is not authenticated");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.idToken}`,
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${url}`, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();
    if (!response.status.toString().startsWith("2")) {
      console.error("API request failed:", data);
      return {
        status: false,
        error: data.error || "INTERNAL_ERROR",
        message:
          data.message || "An error occurred while processing your request.",
      };
    }
    return {
      ...data,
      status: true,
    };
  } catch (error) {
    console.error("API request error:", error);
    return {
      status: false,
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again.",
    };
  }
};

export const fetchPublicData = async (url: string, options: any = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${url}`, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();
    if (!response.status.toString().startsWith("2")) {
      console.error("API request failed:", data);
      return {
        status: false,
        error: data.error || "INTERNAL_ERROR",
        message:
          data.message || "An error occurred while processing your request.",
      };
    }
    return {
      ...data,
      status: true,
    };
  } catch (error) {
    console.error("API request error:", error);
    return {
      status: false,
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again.",
    };
  }
};

export const formattedBalance = (balance: string): string => {
  return (
    (parseFloat(ethers.formatUnits(balance)) * 10 ** 5) /
    10 ** 5
  ).toFixed(5);
};

export const checkWhitelistedContract = async (address: string) => {
  if (!address) {
    return false;
  }
  const contract = await prisma.contract.findUnique({
    where: { address },
    select: { address: true },
  });
  return !!contract;
};

export const checkWhitelistedSender = async (address: string) => {
  if (!address) {
    return false;
  }
  const sender = await prisma.sender.findUnique({
    where: { address },
    select: { address: true },
  });
  return !!sender;
};

export const getDappfromContract = async (address: string) => {
  const contract = await prisma.contract.findUnique({
    where: { address },
  });
  if (!contract) {
    return null;
  }
  return await prisma.dApp.findUnique({
    where: { id: contract?.dappId },
    include: {
      contracts: true,
    },
  });
};

export const getDappfromSender = async (address: string) => {
  const sender = await prisma.sender.findUnique({
    where: { address },
  });
  if (!sender) {
    return null;
  }
  return await prisma.dApp.findUnique({
    where: { id: sender?.dappId },
  });
};

export const isEnoughBalance = (balance: bigint) => {
  return balance > parseKaia("0.1") ? true : false;
};

export const updateDappWithFee = async (dapp: DApp, fee: bigint) => {
  const balance = BigInt(dapp?.balance) - fee;
  const totalUsed = BigInt(dapp?.totalUsed) + fee;
  await prisma.dApp.update({
    where: { id: dapp.id },
    data: { balance: balance.toString(), totalUsed: totalUsed.toString() },
  });
};

// ABI Definitions for swap validation
const capybaraSwapAbi = [
  "function multicall(uint256 deadline, bytes[] data)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to)",
];

export const validateSwapTransaction = async (
  dapp: any,
  tx: any
): Promise<boolean> => {
  try {
    let isCapybaraSwap = false;
    let isDragonSwap = false;
    if (dapp?.name.toLowerCase() === "dragonswap") {
      isDragonSwap = true;
    } else if (dapp?.name.toLowerCase() === "capybara") {
      isCapybaraSwap = true;
    }

    if (isDragonSwap || isCapybaraSwap) {
      console.log(dapp.name + " validateSwapTransaction Details:");
      console.log(JSON.stringify(tx));
    }

    if (!dapp.contracts?.some((contract: any) => contract.hasSwap)) {
      console.log("Not a swap transaction, proceed");
      return true; // Not a swap transaction, proceed
    }

    const toAddress = tx.to?.toLowerCase();
    const swapContract = dapp.contracts.find(
      (contract: any) =>
        contract.hasSwap && contract.address.toLowerCase() === toAddress
    );

    if (!swapContract) {
      console.log("No swap contract found, proceed");
      return true; // Not a swap transaction, proceed
    }

    if (isCapybaraSwap) {
      try {
        const iface = new ethers.Interface(capybaraSwapAbi);
        const decodedMulticall = iface.decodeFunctionData("multicall", tx.data);
        const dataArray = decodedMulticall[1];

        for (const call of dataArray) {
          const selector = call.slice(0, 10);

          switch (selector.toLowerCase()) {
            case iface
              .getFunction("swapExactTokensForTokens")
              ?.selector.toLowerCase():
              try {
                const decoded = iface.decodeFunctionData(
                  "swapExactTokensForTokens",
                  call
                );
                const path = decoded.path || decoded[2];
                const tokenIn = path[0];
                const tokenOut = path[path.length - 1];

                return (
                  tokenOut.toLowerCase() ===
                    swapContract.swapAddress?.toLowerCase() ||
                  tokenIn.toLowerCase() ===
                    swapContract.swapAddress?.toLowerCase()
                );
              } catch (err) {
                console.error(
                  "Failed to decode capybaraswap transaction:",
                  err
                );
                return false;
              }
              break;

            default:
              console.error("Unknown selector:", selector);
              return false;
          }
        }
      } catch (error) {
        console.error("Failed to validate capybaraswap transaction:", error);
        return false;
      }
    } else if (isDragonSwap) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to validate swap transaction:", error);
    return false;
  }
};
