import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createResponse, formattedBalance, checkContractExistsForNoApiKeyDapps, checkSenderExistsForNoApiKeyDapps } from "@/lib/apiUtils";
import { verify } from "@/lib/verifyToken";
import { Dapp, Contract, Sender, ApiKey } from "@/app/types/index";

export async function GET() {
  try {
    const dapps = await prisma.dApp.findMany({
      select: {
        name: true,
        url: true,
        balance: true,
        totalUsed: true,
        createdAt: true
      }
    });
    
    const formattedDapps = dapps.map((dapp) => ({
      ...dapp,
      totalUsed: formattedBalance(dapp.totalUsed),
      balance: formattedBalance(dapp.balance)
    }));

    return createResponse("SUCCESS", formattedDapps);
  } catch (error) {
    console.error("Error fetching dapps:", error);
    return createResponse("INTERNAL_ERROR", "Failed to fetch dapps");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to create DApps");
    }

    const { name, url, balance, terminationDate, contracts, senders, apiKeys, emailAlerts } = await req.json();

    // Validate required fields
    if (!name || !url) {
      return createResponse("BAD_REQUEST", "Name and URL are required");
    }

    // Validate arrays (make them optional)
    const contractsArray = Array.isArray(contracts) ? contracts : [];
    const sendersArray = Array.isArray(senders) ? senders : [];
    const apiKeysArray = Array.isArray(apiKeys) ? apiKeys : [];

    // Prepare data with proper types
    const data: {
      name: string;
      url: string;
      active: boolean;
      balance: string;
      totalUsed: string;
      terminationDate?: string;
      contracts?: { create: Array<{ address: string; hasSwap: boolean; swapAddress: string | null; active: boolean }> };
      senders?: { create: Array<{ address: string; active: boolean }> };
      apiKeys?: { create: Array<{ key: string; name: string }> };
      emailAlerts?: { create: Array<{ email: string; balanceThreshold: string; isActive: boolean }> };
    } = {
      name,
      url,
      active: true,
      balance: "0",
      totalUsed: "0",
    };

    // Add contracts if provided
    if (contractsArray.length > 0) {
      data.contracts = {
        create: contractsArray.map((contract: Contract) => ({
          address: contract.address.toLowerCase(),
          hasSwap: contract.hasSwap || false,
          swapAddress: contract.hasSwap ? (contract.swapAddress?.toLowerCase() || null) : null,
          active: true,
        })),
      };
    }

    // Add senders if provided
    if (sendersArray.length > 0) {
      data.senders = {
        create: sendersArray.map((sender: Sender) => ({
          address: sender.address.toLowerCase(),
          active: true,
        })),
      };
    }

    // Add API keys if provided
    if (apiKeysArray.length > 0) {
      data.apiKeys = {
        create: apiKeysArray.map((apiKey: ApiKey) => ({
          key: apiKey.key,
          name: apiKey.name,
        })),
      };
    }

    // Validate duplicate contract addresses and sender addresses when no API keys are provided
    if (apiKeysArray.length === 0) {
      // Check for duplicate contract addresses
      for (const contract of contractsArray) {
        const existingContract = await checkContractExistsForNoApiKeyDapps(contract.address);
        if (existingContract) {
          return createResponse("BAD_REQUEST", `Contract address ${contract.address} already exists in another DApp without API keys`);
        }
      }

      // Check for duplicate sender addresses
      for (const sender of sendersArray) {
        const existingSender = await checkSenderExistsForNoApiKeyDapps(sender.address);
        if (existingSender) {
          return createResponse("BAD_REQUEST", `Sender address ${sender.address} already exists in another DApp without API keys`);
        }
      }
    }

    // Add email alerts if provided
    const emailAlertsArray = Array.isArray(emailAlerts) ? emailAlerts : [];
    if (emailAlertsArray.length > 0) {
      data.emailAlerts = {
        create: emailAlertsArray.map((alert: { email: string; balanceThreshold: number; isActive: boolean }) => {
          // Convert balance threshold to wei
          const thresholdNum = Number(alert.balanceThreshold);
          if (isNaN(thresholdNum) || thresholdNum < 0) {
            throw new Error(`Invalid balance threshold: ${alert.balanceThreshold}`);
          }
          const thresholdWei = ethers.parseUnits(thresholdNum.toString(), 18);
          
          return {
            email: alert.email,
            balanceThreshold: thresholdWei.toString(),
            isActive: alert.isActive,
          };
        }),
      };
    }

    // Validate DApp data
    if (!verifyDapp({
      name,
      url,
      balance,
      terminationDate,
      contracts: contractsArray,
      senders: sendersArray,
      apiKeys: apiKeysArray,
    })) {
      return createResponse("BAD_REQUEST", "Invalid DApp data. Please check all fields.");
    }

    // Handle balance
    try {
      if (balance) {
        const balanceNum = Number(balance);
        if (isNaN(balanceNum) || balanceNum < 0) {
          return createResponse("BAD_REQUEST", "Invalid balance amount");
        }
        // Use ethers.parseUnits to handle decimal numbers properly
        const balanceWei = ethers.parseUnits(balanceNum.toString(), 18);
        data.balance = balanceWei.toString();
      }
    } catch (error) {
      return createResponse("BAD_REQUEST", "Invalid balance format");
    }

    // Add termination date if provided
    if (terminationDate) {
      try {
        new Date(terminationDate); // Validate date format
        data.terminationDate = terminationDate;
      } catch (error) {
        return createResponse("BAD_REQUEST", "Invalid termination date format");
      }
    }

    // Create DApp with error handling
    try {
      const dapp = await prisma.dApp.create({
        data,
        include: {
          contracts: true,
          senders: true,
          apiKeys: true,
          // @ts-ignore - emailAlerts relation exists in schema
          emailAlerts: true,
        },
      });

      return createResponse("SUCCESS", {
        ...dapp,
        balance: ethers.formatUnits(dapp.balance),
        totalUsed: ethers.formatUnits(dapp.totalUsed),
        emailAlerts: (dapp as { emailAlerts?: Array<{ balanceThreshold: string; [key: string]: unknown }> }).emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: ethers.formatUnits(alert.balanceThreshold, 18)
        })) || []
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return createResponse("CONFLICT", "A DApp with this name or address combination already exists");
      }
      throw error; // Re-throw for general error handling
    }
  } catch (error) {
    console.error("Error creating dapp:", error);
    if (error instanceof Error) {
      return createResponse("INTERNAL_ERROR", `Failed to create dapp: ${error.message}`);
    }
    return createResponse("INTERNAL_ERROR", "Failed to create dapp");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage DApps");
    }

    const requestData = await req.json();
    const { id, name, url, balance, terminationDate, active, contracts, senders, apiKeys, emailAlerts } = requestData;

    // Validate required fields
    if (!id) {
      return createResponse("BAD_REQUEST", "DApp ID is required");
    }

    // Check if this is a simple update (just basic fields) or full update
    const isFullUpdate = contracts !== undefined || senders !== undefined || apiKeys !== undefined || emailAlerts !== undefined;

    if (isFullUpdate) {
      // Full update with nested data
      const updateData: {
        name?: string;
        url?: string;
        terminationDate?: string;
        balance?: string;
      } = {
        name,
        url,
        terminationDate,
      };

      // Handle balance
      if (balance !== undefined) {
        try {
          const balanceNum = Number(balance);
          if (isNaN(balanceNum) || balanceNum < 0) {
            return createResponse("BAD_REQUEST", "Invalid balance amount");
          }
          // Use ethers.parseUnits to handle decimal numbers properly
          const balanceWei = ethers.parseUnits(balanceNum.toString(), 18);
          updateData.balance = balanceWei.toString();
        } catch (error) {
          return createResponse("BAD_REQUEST", "Invalid balance format");
        }
      }

      // Validate the full DApp data
      const fullDappData = {
        id,
        name,
        url,
        balance,
        terminationDate,
        contracts: contracts || [],
        senders: senders || [],
        apiKeys: apiKeys || [],
        emailAlerts: emailAlerts || [],
      };

      if (!verifyDapp(fullDappData)) {
        return createResponse("BAD_REQUEST", "Invalid DApp data. Please check all fields.");
      }

      // Validate duplicate contract addresses and sender addresses when no API keys are provided
      const apiKeysArray = Array.isArray(apiKeys) ? apiKeys : [];
      if (apiKeysArray.length === 0) {
        // Check for duplicate contract addresses (excluding current dapp)
        for (const contract of (contracts || [])) {
          const existingContract = await checkContractExistsForNoApiKeyDapps(contract.address);
          if (existingContract && existingContract.dappId !== id) {
            return createResponse("BAD_REQUEST", `Contract address ${contract.address} already exists in another DApp without API keys`);
          }
        }

        // Check for duplicate sender addresses (excluding current dapp)
        for (const sender of (senders || [])) {
          const existingSender = await checkSenderExistsForNoApiKeyDapps(sender.address);
          if (existingSender && existingSender.dappId !== id) {
            return createResponse("BAD_REQUEST", `Sender address ${sender.address} already exists in another DApp without API keys`);
          }
        }
      }

      try {
        // Use transaction to update everything atomically
        const result = await prisma.$transaction(async (tx) => {
          // Update main DApp data
          const updatedDapp = await tx.dApp.update({
            where: { id },
            data: updateData,
          });

          // Delete existing related data
          await tx.contract.deleteMany({ where: { dappId: id } });
          await tx.sender.deleteMany({ where: { dappId: id } });
          await tx.apiKey.deleteMany({ where: { dappId: id } });
          // @ts-ignore - emailAlert relation exists in schema
          await tx.emailAlert.deleteMany({ where: { dappId: id } });

          // Create new contracts
          if (contracts && contracts.length > 0) {
            await tx.contract.createMany({
              data: contracts.map((contract: Contract) => ({
                dappId: id,
                address: contract.address.toLowerCase(),
                hasSwap: contract.hasSwap || false,
                swapAddress: contract.hasSwap ? contract.swapAddress?.toLowerCase() : null,
                active: true,
              })),
            });
          }

          // Create new senders
          if (senders && senders.length > 0) {
            await tx.sender.createMany({
              data: senders.map((sender: Sender) => ({
                dappId: id,
                address: sender.address.toLowerCase(),
                active: true,
              })),
            });
          }

          // Create new API keys
          if (apiKeys && apiKeys.length > 0) {
            await tx.apiKey.createMany({
              data: apiKeys.map((apiKey: ApiKey) => ({
                dappId: id,
                key: apiKey.key,
                name: apiKey.name,
                active: true,
              })),
            });
          }

          // Create new email alerts
          if (emailAlerts && emailAlerts.length > 0) {
            // @ts-ignore - emailAlert relation exists in schema
            await tx.emailAlert.createMany({
              data: emailAlerts.map((alert: { email: string; balanceThreshold: number; isActive: boolean }) => {
                // Convert balance threshold to wei
                const thresholdNum = Number(alert.balanceThreshold);
                if (isNaN(thresholdNum) || thresholdNum < 0) {
                  throw new Error(`Invalid balance threshold: ${alert.balanceThreshold}`);
                }
                const thresholdWei = ethers.parseUnits(thresholdNum.toString(), 18);
                
                return {
                  dappId: id,
                  email: alert.email,
                  balanceThreshold: thresholdWei.toString(),
                  isActive: alert.isActive,
                };
              }),
            });
          }

          return updatedDapp;
        });
      } catch (error) {
        console.error("Transaction error:", error);
        return createResponse("INTERNAL_ERROR", `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Fetch the complete updated DApp with all relations
      const completeDapp = await prisma.dApp.findUnique({
        where: { id },
        include: {
          contracts: true,
          senders: true,
          apiKeys: true,
          // @ts-ignore - emailAlerts relation exists in schema
          emailAlerts: true,
        },
      });

      return createResponse("SUCCESS", {
        ...completeDapp,
        balance: ethers.formatUnits(completeDapp!.balance),
        totalUsed: ethers.formatUnits(completeDapp!.totalUsed),
        emailAlerts: (completeDapp as { emailAlerts?: Array<{ balanceThreshold: string; [key: string]: unknown }> }).emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: ethers.formatUnits(alert.balanceThreshold, 18)
        })) || []
      });

    } else {
      // Simple update (for backward compatibility)
      const updateData: {
        name?: string;
        url?: string;
        terminationDate?: string;
        active?: boolean;
        balance?: string;
      } = {};

      if (name) {
        updateData.name = name;
      }

      if (url) {
        updateData.url = url;
      }

      if (terminationDate) {
        updateData.terminationDate = terminationDate;
      }

      if (typeof active === "boolean") {
        updateData.active = active;
      }

      if (balance) {
        try {
          const balanceNum = Number(balance);
          if (isNaN(balanceNum) || balanceNum < 0) {
            return createResponse("BAD_REQUEST", "Invalid balance amount");
          }
          // Use ethers.parseUnits to handle decimal numbers properly
          const balanceWei = ethers.parseUnits(balanceNum.toString(), 18);
          updateData.balance = balanceWei.toString();
        } catch (error) {
          return createResponse("BAD_REQUEST", "Invalid balance format");
        }
      }

      const dataToVerify = { id, ...updateData } as unknown as Dapp;
      if (!verifyDapp(dataToVerify)) {
        return createResponse("BAD_REQUEST", "Invalid dapp data");
      }

      const dapp = await prisma.dApp.update({
        where: { id },
        data: updateData,
      });

      return createResponse("SUCCESS", {
        ...dapp,
        balance: ethers.formatUnits(dapp.balance),
      });
    }

  } catch (error: unknown) {
    console.error("Error updating dapp:", error);
    console.error("Error details:", {
      message: error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unknown error',
      code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'Unknown code',
      stack: error && typeof error === 'object' && 'stack' in error ? String(error.stack) : 'No stack'
    });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return createResponse("CONFLICT", "A DApp with this name already exists");
    }
    return createResponse("INTERNAL_ERROR", `Failed to update dapp: ${error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unknown error'}`);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role } = await verify(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );
    if (role !== "editor") {
      return createResponse("UNAUTHORIZED", "You don't have permission to manage DApps");
    }

    const { id } = await req.json();

    await prisma.dApp.delete({
      where: {
        id,
      },
    });

    return createResponse("SUCCESS", { message: "Dapp deleted" });
  } catch (error) {
    console.error("Error deleting dapp:", JSON.stringify(error));
    return createResponse("INTERNAL_ERROR", "Failed to delete dapp");
  }
}

const verifyDapp = (dapp: Dapp) => {
  // Check for forbidden fields
  if ("totalUsed" in dapp || "createdAt" in dapp) {
    return false;
  }
  
  // Check name
  if (dapp.name && dapp.name.trim() === "") {
    return false;
  }
  
  // Check URL
  if (dapp.url && !isValidHttpUrl(dapp.url)) {
    return false;
  }
  
  // Check balance
  if (dapp.balance) {
    try {
      const balanceNum = Number(dapp.balance);
      if (isNaN(balanceNum) || balanceNum < 0) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }
  
  // Check contracts
  if (dapp.contracts && dapp.contracts.length !== 0) {
    const invalidContracts = dapp.contracts.filter(contract => !ethers.isAddress(contract.address));
    if (invalidContracts.length > 0) {
      return false;
    }
    
    // Check swap addresses
    const invalidSwapContracts = dapp.contracts.filter(
      contract => contract.hasSwap && (!contract.swapAddress || !ethers.isAddress(contract.swapAddress))
    );
    if (invalidSwapContracts.length > 0) {
      return false;
    }
  }
  
  // Check senders
  if (dapp.senders && dapp.senders.length !== 0) {
    const invalidSenders = dapp.senders.filter(sender => !ethers.isAddress(sender.address));
    if (invalidSenders.length > 0) {
      return false;
    }
  }
  
  // Check API keys
  if (dapp.apiKeys && dapp.apiKeys.length !== 0) {
    const invalidApiKeys = dapp.apiKeys.filter(apiKey => !apiKey.key || !apiKey.name);
    if (invalidApiKeys.length > 0) {
      return false;
    }
  }
  
  return true;
};

const isValidHttpUrl = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};
