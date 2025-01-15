import { createResponse } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";
import { NextRequest } from "next/server";
import { formattedBalance } from "@/lib/apiUtils";
import pickProviderFromPool from "@/lib/rpcProvider";

export async function GET(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("INTERNAL_ERROR", "Unauthorized");
    }

    const balance = await pickProviderFromPool().getBalance(
      process.env.ACCOUNT_ADDRESS as string,
      "latest"
    );
    return createResponse("SUCCESS", formattedBalance(balance.toString()));
  } catch (error) {
    console.error("Error fetching dapps:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch dapps");
  }
}
