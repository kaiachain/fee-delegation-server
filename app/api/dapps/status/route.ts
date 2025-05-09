import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
import { createResponse } from "@/lib/apiUtils";

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage DApps");
    }

    const { id, active } = await request.json();

    if (!id || typeof active !== "boolean") {
      return createResponse("BAD_REQUEST", "Invalid request");
    }

    const updatedDapp = await prisma.dApp.update({
      where: { id },
      data: { active },
    });

    return createResponse("SUCCESS", updatedDapp);
  } catch (error) {
    console.error("Error updating dapp status:", error);
    return createResponse("INTERNAL_ERROR", "Failed to update dapp status");
  }
} 