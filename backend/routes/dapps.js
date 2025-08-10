const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { createResponse, formattedBalance, checkContractExistsForNoApiKeyDapps, checkSenderExistsForNoApiKeyDapps } = require('../utils/apiUtils');
const { requireEditor } = require('../middleware/auth');


// GET /api/dapps
router.get('/', async (req, res) => {
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

    return createResponse(res, "SUCCESS", formattedDapps);
  } catch (error) {
    console.error("Error fetching dapps:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to fetch dapps");
  }
});

// POST /api/dapps
router.post('/', requireEditor, async (req, res) => {
  try {

    const { name, url, balance, terminationDate, contracts, senders, apiKeys, emailAlerts } = req.body;

    // Validate required fields
    if (!name || !url) {
      return createResponse(res, "BAD_REQUEST", "Name and URL are required");
    }

    // Validate arrays (make them optional)
    const contractsArray = Array.isArray(contracts) ? contracts : [];
    const sendersArray = Array.isArray(senders) ? senders : [];
    const apiKeysArray = Array.isArray(apiKeys) ? apiKeys : [];

    // Prepare data with proper types
    const data = {
      name,
      url,
      active: true,
      balance: "0",
      totalUsed: "0",
    };

    // Add contracts if provided
    if (contractsArray.length > 0) {
      data.contracts = {
        create: contractsArray.map((contract) => ({
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
        create: sendersArray.map((sender) => ({
          address: sender.address.toLowerCase(),
          active: true,
        })),
      };
    }

    // Add API keys if provided
    if (apiKeysArray.length > 0) {
      data.apiKeys = {
        create: apiKeysArray.map((apiKey) => ({
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
          return createResponse(res, "BAD_REQUEST", `Contract address ${contract.address} already exists in another DApp without API keys`);
        }
      }

      // Check for duplicate sender addresses
      for (const sender of sendersArray) {
        const existingSender = await checkSenderExistsForNoApiKeyDapps(sender.address);
        if (existingSender) {
          return createResponse(res, "BAD_REQUEST", `Sender address ${sender.address} already exists in another DApp without API keys`);
        }
      }
    }

    // Add email alerts if provided
    const emailAlertsArray = Array.isArray(emailAlerts) ? emailAlerts : [];
    if (emailAlertsArray.length > 0) {
      data.emailAlerts = {
        create: emailAlertsArray.map((alert) => {
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
      return createResponse(res, "BAD_REQUEST", "Invalid DApp data. Please check all fields.");
    }

    // Handle balance
    try {
      if (balance) {
        const balanceNum = Number(balance);
        if (isNaN(balanceNum) || balanceNum < 0) {
          return createResponse(res, "BAD_REQUEST", "Invalid balance amount");
        }
        // Use ethers.parseUnits to handle decimal numbers properly
        const balanceWei = ethers.parseUnits(balanceNum.toString(), 18);
        data.balance = balanceWei.toString();
      }
    } catch (error) {
      return createResponse(res, "BAD_REQUEST", "Invalid balance format");
    }

    // Add termination date if provided
    if (terminationDate) {
      try {
        new Date(terminationDate); // Validate date format
        data.terminationDate = terminationDate;
      } catch (error) {
        return createResponse(res, "BAD_REQUEST", "Invalid termination date format");
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
          emailAlerts: true,
        },
      });

      return createResponse(res, "SUCCESS", {
        ...dapp,
        balance: ethers.formatUnits(dapp.balance),
        totalUsed: ethers.formatUnits(dapp.totalUsed),
        emailAlerts: dapp.emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: ethers.formatUnits(alert.balanceThreshold, 18)
        })) || []
      });
    } catch (error) {
      if (error && error.code === 'P2002') {
        return createResponse(res, "CONFLICT", "A DApp with this name or address combination already exists");
      }
      throw error; // Re-throw for general error handling
    }
  } catch (error) {
    console.error("Error creating dapp:", error);
    if (error instanceof Error) {
      return createResponse(res, "INTERNAL_ERROR", `Failed to create dapp: ${error.message}`);
    }
    return createResponse(res, "INTERNAL_ERROR", "Failed to create dapp");
  }
});

// PUT /api/dapps
router.put('/', requireEditor, async (req, res) => {
  try {

    const { id, name, url, balance, terminationDate, active, contracts, senders, apiKeys, emailAlerts } = req.body;

    // Validate required fields
    if (!id) {
      return createResponse(res, "BAD_REQUEST", "DApp ID is required");
    }

    // Check if this is a simple update (just basic fields) or full update
    const isFullUpdate = contracts !== undefined || senders !== undefined || apiKeys !== undefined || emailAlerts !== undefined;

    if (isFullUpdate) {
      // Full update with nested data
      const updateData = {
        name,
        url,
        terminationDate,
      };

      // Handle balance
      if (balance !== undefined) {
        try {
          const balanceNum = Number(balance);
          if (isNaN(balanceNum) || balanceNum < 0) {
            return createResponse(res, "BAD_REQUEST", "Invalid balance amount");
          }
          // Use ethers.parseUnits to handle decimal numbers properly
          const balanceWei = ethers.parseUnits(balanceNum.toString(), 18);
          updateData.balance = balanceWei.toString();
        } catch (error) {
          return createResponse(res, "BAD_REQUEST", "Invalid balance format");
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
        return createResponse(res, "BAD_REQUEST", "Invalid DApp data. Please check all fields.");
      }

      // Validate duplicate contract addresses and sender addresses when no API keys are provided
      const apiKeysArray = Array.isArray(apiKeys) ? apiKeys : [];
      if (apiKeysArray.length === 0) {
        // Check for duplicate contract addresses (excluding current dapp)
        for (const contract of (contracts || [])) {
          const existingContract = await checkContractExistsForNoApiKeyDapps(contract.address);
          if (existingContract && existingContract.dappId !== id) {
            return createResponse(res, "BAD_REQUEST", `Contract address ${contract.address} already exists in another DApp without API keys`);
          }
        }

        // Check for duplicate sender addresses (excluding current dapp)
        for (const sender of (senders || [])) {
          const existingSender = await checkSenderExistsForNoApiKeyDapps(sender.address);
          if (existingSender && existingSender.dappId !== id) {
            return createResponse(res, "BAD_REQUEST", `Sender address ${sender.address} already exists in another DApp without API keys`);
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
          await tx.emailAlert.deleteMany({ where: { dappId: id } });

          // Create new contracts
          if (contracts && contracts.length > 0) {
            await tx.contract.createMany({
              data: contracts.map((contract) => ({
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
              data: senders.map((sender) => ({
                dappId: id,
                address: sender.address.toLowerCase(),
                active: true,
              })),
            });
          }

          // Create new API keys
          if (apiKeys && apiKeys.length > 0) {
            await tx.apiKey.createMany({
              data: apiKeys.map((apiKey) => ({
                dappId: id,
                key: apiKey.key,
                name: apiKey.name,
                active: true,
              })),
            });
          }

          // Create new email alerts
          if (emailAlerts && emailAlerts.length > 0) {
            await tx.emailAlert.createMany({
              data: emailAlerts.map((alert) => {
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
        return createResponse(res, "INTERNAL_ERROR", `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Fetch the complete updated DApp with all relations
      const completeDapp = await prisma.dApp.findUnique({
        where: { id },
        include: {
          contracts: true,
          senders: true,
          apiKeys: true,
          emailAlerts: true,
        },
      });

      return createResponse(res, "SUCCESS", {
        ...completeDapp,
        balance: ethers.formatUnits(completeDapp.balance),
        totalUsed: ethers.formatUnits(completeDapp.totalUsed),
        emailAlerts: completeDapp.emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: ethers.formatUnits(alert.balanceThreshold, 18)
        })) || []
      });

    } else {
      // Simple update (for backward compatibility)
      const updateData = {};

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
      return createResponse(res, "BAD_REQUEST", "Invalid balance amount");
          }
          // Use ethers.parseUnits to handle decimal numbers properly
          const balanceWei = ethers.parseUnits(balanceNum.toString(), 18);
          updateData.balance = balanceWei.toString();
        } catch (error) {
          return createResponse(res, "BAD_REQUEST", "Invalid balance format");
        }
      }

      const dataToVerify = { id, ...updateData };
      if (!verifyDapp(dataToVerify)) {
        return createResponse(res, "BAD_REQUEST", "Invalid dapp data");
      }

      const dapp = await prisma.dApp.update({
        where: { id },
        data: updateData,
      });

      return createResponse(res, "SUCCESS", {
        ...dapp,
        balance: ethers.formatUnits(dapp.balance),
      });
    }

  } catch (error) {
    console.error("Error updating dapp:", error);
    console.error("Error details:", {
      message: error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unknown error',
      code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'Unknown code',
      stack: error && typeof error === 'object' && 'stack' in error ? String(error.stack) : 'No stack'
    });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return createResponse(res, "CONFLICT", "A DApp with this name already exists");
    }
    return createResponse(res, "INTERNAL_ERROR", `Failed to update dapp: ${error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unknown error'}`);
  }
});

// DELETE /api/dapps
router.delete('/', requireEditor, async (req, res) => {
  try {

    const { id } = req.body;

    await prisma.dApp.delete({
      where: {
        id,
      },
    });

    return createResponse(res, "SUCCESS", { message: "Dapp deleted" });
  } catch (error) {
    console.error("Error deleting dapp:", JSON.stringify(error));
    return createResponse(res, "INTERNAL_ERROR", "Failed to delete dapp");
  }
});

// GET /api/dapps/management
router.get('/management', requireEditor, async (req, res) => {
  try {

    const dapps = await prisma.dApp.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        balance: true,
        totalUsed: true,
        active: true,
        createdAt: true,
        terminationDate: true,
        contracts: {
          select: {
            id: true,
            address: true,
            hasSwap: true,
            swapAddress: true,
            active: true,
            createdAt: true
          }
        },
        senders: {
          select: {
            id: true,
            address: true,
            active: true
          }
        },
        apiKeys: {
          select: {
            id: true,
            key: true,
            name: true,
            createdAt: true
          }
        },
        emailAlerts: {
          select: {
            id: true,
            email: true,
            balanceThreshold: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    const formattedDapps = dapps.map((dapp) => {
      // Calculate active and inactive counts
      const activeContracts = dapp.contracts.filter((contract) => contract.active !== false);
      const inactiveContracts = dapp.contracts.filter((contract) => contract.active === false);
      const activeSenders = dapp.senders.filter((sender) => sender.active !== false);
      const inactiveSenders = dapp.senders.filter((sender) => sender.active === false);
      const activeApiKeys = dapp.apiKeys.filter((key) => key.active !== false);
      const inactiveApiKeys = dapp.apiKeys.filter((key) => key.active === false);

      return {
        ...dapp,
        totalUsed: formattedBalance(dapp.totalUsed),
        balance: formattedBalance(dapp.balance),
        emailAlerts: dapp.emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: ethers.formatUnits(alert.balanceThreshold, 18)
        })) || []
      };
    });

    return createResponse(res, "SUCCESS", formattedDapps);
  } catch (error) {
    console.error("Error fetching dapps for management:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to fetch dapps");
  }
});

const verifyDapp = (dapp) => {
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

const isValidHttpUrl = (urlStr) => {
  try {
    const url = new URL(urlStr);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

module.exports = router; 