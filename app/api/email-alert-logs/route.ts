import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResponse } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";

export async function GET(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to access email alert logs");
    }

    const { searchParams } = new URL(req.url);
    const dappId = searchParams.get("dappId");
    const email = searchParams.get("email");
    const isRead = searchParams.get("isRead");

    const whereClause: any = {};
    
    if (dappId) {
      whereClause.dappId = dappId;
    }
    
    if (email) {
      whereClause.email = email;
    }
    
    if (isRead !== null) {
      whereClause.isRead = isRead === "true";
    }

    const emailAlertLogs = await prisma.emailAlertLog.findMany({
      where: whereClause,
      orderBy: {
        sentAt: "desc"
      }
    });

    return createResponse("SUCCESS", emailAlertLogs);
  } catch (error) {
    console.error("Error fetching email alert logs:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch email alert logs");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage email alert logs");
    }

    const { id, isRead } = await req.json();

    if (!id) {
      return createResponse("BAD_REQUEST", "Missing required field: id");
    }

    const updatedLog = await prisma.emailAlertLog.update({
      where: { id },
      data: { isRead }
    });

    return createResponse("SUCCESS", updatedLog);
  } catch (error) {
    console.error("Error updating email alert log:", error);
    return createResponse("INTERNAL_ERROR", "Failed to update email alert log");
  }
} 