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
  return NextResponse.json({ 
    message, 
    data,
    error: type !== "SUCCESS" ? type : undefined,
    status: type === "SUCCESS"
  }, { status });
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
        message: data.message || "An error occurred while processing your request."
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
      message: "An unexpected error occurred. Please try again."
    };
  }
};

export const fetchPublicData = async (
  url: string,
  options: any = {}
) => {
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
        message: data.message || "An error occurred while processing your request."
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
      message: "An unexpected error occurred. Please try again."
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
    where: { address }
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
    where: { id: sender?.dappId }
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
const multicallAbi = [
  "function multicall(uint256 deadline, bytes[] data)"
];

const exactInputSingleAbi = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96))"
];

export const validateSwapTransaction = async (dapp: any, tx: any): Promise<boolean> => {
  try {
    if (!dapp.contracts?.some((contract: any) => contract.hasSwap)) {
      console.log("Not a swap transaction, proceed");
      return true; // Not a swap transaction, proceed
    }

    const toAddress = tx.to?.toLowerCase();
    const swapContract = dapp.contracts.find((contract: any) => 
      contract.hasSwap && contract.address.toLowerCase() === toAddress
    );

    if (!swapContract) {
      console.log("No swap contract found, proceed");
      return true; // Not a swap transaction, proceed
    }

    // Parse interfaces
    const multicallIface = new ethers.Interface(multicallAbi);
    const exactInputIface = new ethers.Interface(exactInputSingleAbi);

    // Decode multicall
    const { data } = multicallIface.decodeFunctionData("multicall", tx.data);

    // Decode inner call
    const innerCallData = data[0];
    const [params] = exactInputIface.decodeFunctionData("exactInputSingle", innerCallData);

    // Check if the token in/out matches the dapp's swap address
    return (params.tokenOut.toLowerCase() === swapContract.swapAddress?.toLowerCase() ||
    params.tokenIn.toLowerCase() === swapContract.swapAddress?.toLowerCase());
  } catch (error) {
    console.error("Failed to validate swap transaction:", error);
    return false;
  }
};
