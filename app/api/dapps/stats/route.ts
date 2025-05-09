import { NextResponse } from "next/server";
import { createResponse } from "@/lib/apiUtils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dappId = searchParams.get("dappId");

  if (!dappId) {
    return createResponse("BAD_REQUEST", "DApp ID is required");
  }

  // Generate dummy data for the last 6 months
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const stats = months.map(month => ({
    month,
    usage: Math.floor(Math.random() * 1000) // Random usage between 0 and 1000
  }));

  return createResponse("SUCCESS", { stats });
} 