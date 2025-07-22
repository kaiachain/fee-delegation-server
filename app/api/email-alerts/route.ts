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
      return createResponse("UNAUTHORIZED", "You don't have permission to access email alerts");
    }

    const { searchParams } = new URL(req.url);
    const dappId = searchParams.get("dappId");

    const whereClause = dappId ? { dappId } : {};

    const emailAlerts = await prisma.emailAlert.findMany({
      where: whereClause,
      include: {
        dapp: {
          select: {
            id: true,
            name: true,
            balance: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return createResponse("SUCCESS", emailAlerts);
  } catch (error) {
    console.error("Error fetching email alerts:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch email alerts");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage email alerts");
    }

    const { dappId, email, balanceThreshold } = await req.json();

    if (!dappId || !email || !balanceThreshold) {
      return createResponse(
        "BAD_REQUEST",
        "Missing required fields: dappId, email, balanceThreshold"
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createResponse("BAD_REQUEST", "Invalid email format");
    }

    // Check if DApp exists
    const dapp = await prisma.dApp.findUnique({
      where: { id: dappId }
    });

    if (!dapp) {
      return createResponse("NOT_FOUND", "DApp not found");
    }

    // Check if email alert already exists for this DApp and email
    const existingAlert = await prisma.emailAlert.findFirst({
      where: {
        dappId,
        email,
        isActive: true
      }
    });

    if (existingAlert) {
      return createResponse("CONFLICT", "Email alert already exists for this DApp and email");
    }

    const newEmailAlert = await prisma.emailAlert.create({
      data: {
        email,
        balanceThreshold: balanceThreshold.toString(),
        dappId,
        isActive: true
      },
      include: {
        dapp: {
          select: {
            id: true,
            name: true,
            balance: true
          }
        }
      }
    });

    return createResponse("SUCCESS", newEmailAlert);
  } catch (error) {
    console.error("Error creating email alert:", error);
    return createResponse("INTERNAL_ERROR", "Failed to create email alert");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage email alerts");
    }

    const { id, email, balanceThreshold, isActive } = await req.json();

    if (!id) {
      return createResponse("BAD_REQUEST", "Missing required field: id");
    }

    const updateData: any = {};

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return createResponse("BAD_REQUEST", "Invalid email format");
      }
      updateData.email = email;
    }

    if (balanceThreshold !== undefined) {
      updateData.balanceThreshold = balanceThreshold.toString();
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updatedEmailAlert = await prisma.emailAlert.update({
      where: { id },
      data: updateData,
      include: {
        dapp: {
          select: {
            id: true,
            name: true,
            balance: true
          }
        }
      }
    });

    return createResponse("SUCCESS", updatedEmailAlert);
  } catch (error) {
    console.error("Error updating email alert:", error);
    return createResponse("INTERNAL_ERROR", "Failed to update email alert");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage email alerts");
    }

    const { id } = await req.json();

    if (!id) {
      return createResponse("BAD_REQUEST", "Missing required field: id");
    }

    await prisma.emailAlert.delete({
      where: { id }
    });

    return createResponse("SUCCESS", { message: "Email alert deleted successfully" });
  } catch (error) {
    console.error("Error deleting email alert:", error);
    return createResponse("INTERNAL_ERROR", "Failed to delete email alert");
  }
} 