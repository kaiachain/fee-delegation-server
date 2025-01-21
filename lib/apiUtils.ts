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
  BAD_REQUEST: { message: "Bad request", status: 400 },
  METHOD_NOT_ALLOWED: { message: "Method not allowed", status: 405 },
  INTERNAL_ERROR: { message: "Internal server error", status: 500 },
  NOT_FOUND: { message: "Resource not found", status: 404 },
};

export const createResponse = (type: keyof typeof RESPONSE_MAP, data?: any) => {
  const { message, status } = RESPONSE_MAP[type];
  return NextResponse.json({ message, data }, { status });
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
      alert("API request failed:");
      console.log("API request failed:", data);
      return {
        status: false,
      };
    }
    return {
      ...data,
      status: true,
    };
  } catch (error) {
    console.error("API request error:", error);
    throw error;
  }
};

export const formattedBalance = (balance: string): string => {
  return (
    (parseFloat(ethers.formatUnits(balance)) * 10 ** 5) /
    10 ** 5
  ).toFixed(5);
};

export const isWhitelistedContract = async (address: string) => {
  if (!address) {
    return false;
  }
  const contract = await prisma.contract.findUnique({
    where: { address },
  });
  return contract ? true : false;
};

export const isWhitelistedSender = async (address: string) => {
  if (!address) {
    return false;
  }
  const sender = await prisma.sender.findUnique({
    where: { address },
  });
  return sender ? true : false;
};

export const getDappfromContract = async (address: string) => {
  const contract = await prisma.contract.findUnique({
    where: { address },
  });
  if (!contract) {
    return null;
  }
  const dapp = await prisma.dApp.findUnique({
    where: { id: contract?.dappId },
  });
  return dapp;
};

export const getDappfromSender = async (address: string) => {
  const sender = await prisma.sender.findUnique({
    where: { address },
  });
  if (!sender) {
    return null;
  }
  const dapp = await prisma.dApp.findUnique({
    where: { id: sender?.dappId },
  });
  return dapp;
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
