import { NextResponse } from "next/server";
import { Session } from "next-auth";
import { ethers } from "ethers";

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

export const createResponse = (type: keyof typeof RESPONSE_MAP, data?: unknown) => {
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
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
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
          data.data || data.message || "An error occurred while processing your request.",
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

export const fetchPublicData = async (url: string, options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) => {
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
