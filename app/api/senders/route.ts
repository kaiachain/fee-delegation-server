import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createResponse } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("INTERNAL_ERROR", "Unauthorized");
    }

    const { dappId, address } = await req.json();

    if (!dappId || !address) {
      return createResponse(
        "BAD_REQUEST",
        "Missing required fields: dappId, address"
      );
    }

    if (ethers.isAddress(address) === false) {
      return createResponse("BAD_REQUEST", "Invalid address");
    }

    if (
      await prisma.sender.findFirst({
        where: {
          address,
        },
      })
    ) {
      return createResponse("BAD_REQUEST", "Sender already exists");
    }

    const newSender = await prisma.sender.create({
      data: {
        address: address.toLowerCase(),
        dappId,
      },
    });

    return createResponse("SUCCESS", newSender);
  } catch (error) {
    console.error("Error adding sender:", error);
    return createResponse("INTERNAL_ERROR", "Failed to add sender");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("INTERNAL_ERROR", "Unauthorized");
    }

    const { id } = await req.json();

    if (!id) {
      return createResponse("BAD_REQUEST", "Missing required field: id");
    }

    const sender = await prisma.sender.findFirst({
      where: {
        id,
      },
    });

    if (!sender) {
      return createResponse("BAD_REQUEST", "Sender not found");
    }

    await prisma.sender.delete({
      where: {
        id,
      },
    });

    return createResponse("SUCCESS", sender);
  } catch (error) {
    console.error("Error deleting sender:", error);
    return createResponse("INTERNAL_ERROR", "Failed to delete sender");
  }
}
