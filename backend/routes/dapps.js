const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { createResponse, checkContractExistsForNoApiKeyDapps, checkSenderExistsForNoApiKeyDapps } = require('../utils/apiUtils');
const { requireEditorOrSuperAdmin } = require('../middleware/auth');


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
    
    return createResponse(res, "SUCCESS", dapps);
  } catch (error) {
    console.error("Error fetching dapps:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to fetch dapps");
  }
});

// POST /api/dapps
router.post('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    // Only SUPER_ADMIN can create new DApps
    if (req.user?.role !== 'super_admin') {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can create DApps");
    }

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
        emailAlerts: dapp.emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: alert.balanceThreshold
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
router.put('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {

    const { id, name, url, balance, terminationDate, active, contracts, senders, apiKeys, emailAlerts, userAccessEmails } = req.body;

    // Validate required fields
    if (!id) {
      return createResponse(res, "BAD_REQUEST", "DApp ID is required");
    }

    // Authorization check for restricted fields
    const isSuperAdmin = req.user?.role === 'super_admin';
    const isEmailBasedEditor = req.user?.role === 'editor' && req.user?.provider === 'credentials';
    
    // Restricted fields validation
    if (userAccessEmails !== undefined && !isSuperAdmin) {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can modify user access");
    }
    
    if (isEmailBasedEditor && (balance !== undefined || terminationDate !== undefined)) {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can modify balance or service end date");
    }
    
    // Editor role cannot modify contracts or senders
    if (!isSuperAdmin && (contracts !== undefined || senders !== undefined)) {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can modify contracts or sender addresses");
    }
    
    // Only SUPER_ADMIN can activate/deactivate DApps
    if (active !== undefined && !isSuperAdmin) {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can activate or deactivate DApps");
    }

    // Check if this is a simple update (just basic fields) or full update
    const isFullUpdate = contracts !== undefined || senders !== undefined || apiKeys !== undefined || emailAlerts !== undefined || userAccessEmails !== undefined;

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

      // Validate userAccessEmails if provided
      if (userAccessEmails !== undefined) {
        const userAccessEmailsArray = Array.isArray(userAccessEmails) ? userAccessEmails : [];
        const invalidEmails = [];
        
        for (const email of userAccessEmailsArray) {
          const user = await prisma.user.findUnique({ 
            where: { email, isActive: true } 
          });
          if (!user) {
            invalidEmails.push(email);
          }
        }
        
        if (invalidEmails.length > 0) {
          return createResponse(res, "BAD_REQUEST", `Invalid or inactive user emails: ${invalidEmails.join(', ')}`);
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

          // Get existing related data for comparison
          const existingContracts = await tx.contract.findMany({ where: { dappId: id } });
          const existingSenders = await tx.sender.findMany({ where: { dappId: id } });
          const existingApiKeys = await tx.apiKey.findMany({ where: { dappId: id } });
          const existingEmailAlerts = await tx.emailAlert.findMany({ where: { dappId: id } });
          const existingUserAccess = await tx.userDappAccess.findMany({ 
            where: { dappId: id },
            include: { user: { select: { email: true } } }
          });

          // Smart contract updates
          if (contracts !== undefined) {
            await updateContracts(tx, id, existingContracts, contracts);
          }

          // Smart sender updates
          if (senders !== undefined) {
            await updateSenders(tx, id, existingSenders, senders);
          }

          // Smart API key updates
          if (apiKeys !== undefined) {
            await updateApiKeys(tx, id, existingApiKeys, apiKeys);
          }

          // Smart email alerts updates
          if (emailAlerts !== undefined) {
            await updateEmailAlerts(tx, id, existingEmailAlerts, emailAlerts);
          }

          // Smart user access updates
          if (userAccessEmails !== undefined) {
            await updateUserAccess(tx, id, existingUserAccess, userAccessEmails);
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
          userAccess: {
            include: { 
              user: { 
                select: { id: true, email: true, firstName: true, lastName: true, isActive: true } 
              } 
            }
          },
        },
      });

      return createResponse(res, "SUCCESS", {
        ...completeDapp,
        emailAlerts: completeDapp.emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: alert.balanceThreshold
        })) || [],
        assignedUsers: completeDapp.userAccess?.map((access) => access.user) || []
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
        include: {
          contracts: true,
          senders: true,
          apiKeys: true,
          emailAlerts: true,
          userAccess: {
            include: { 
              user: { 
                select: { id: true, email: true, firstName: true, lastName: true, isActive: true } 
              } 
            }
          },
        },
      });

      return createResponse(res, "SUCCESS", {
        ...dapp,
        emailAlerts: dapp.emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: alert.balanceThreshold
        })) || [],
        assignedUsers: dapp.userAccess?.map((access) => access.user) || []
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
router.delete('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    // Only SUPER_ADMIN can delete DApps
    if (req.user?.role !== 'super_admin') {
      return createResponse(res, "UNAUTHORIZED", "Only Super Admin can delete DApps");
    }

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
router.get('/management', requireEditorOrSuperAdmin, async (req, res) => {
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
        },
        userAccess: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true
              }
            }
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
        emailAlerts: dapp.emailAlerts?.map((alert) => ({
          ...alert,
          balanceThreshold: alert.balanceThreshold
        })) || [],
        assignedUsers: dapp.userAccess?.map((access) => access.user) || []
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

// Smart update helper functions
const updateContracts = async (tx, dappId, existingContracts, newContracts) => {
  const existingMap = new Map(existingContracts.map(c => [c.address.toLowerCase(), c]));
  const newMap = new Map(newContracts.map(c => [c.address.toLowerCase(), c]));
  
  // Delete contracts that are no longer in the new list
  const toDelete = existingContracts.filter(c => !newMap.has(c.address.toLowerCase()));
  if (toDelete.length > 0) {
    await tx.contract.deleteMany({
      where: { id: { in: toDelete.map(c => c.id) } }
    });
  }
  
  let updatedCount = 0;
  let createdCount = 0;
  
  // Update existing contracts or create new ones
  for (const newContract of newContracts) {
    const address = newContract.address.toLowerCase();
    const existingContract = existingMap.get(address);
    
    if (existingContract) {
      // Update existing contract if data changed
      const needsUpdate = 
        existingContract.hasSwap !== (newContract.hasSwap || false) ||
        existingContract.swapAddress !== (newContract.hasSwap ? newContract.swapAddress?.toLowerCase() : null) ||
        existingContract.active !== (newContract.active !== false);
      
      if (needsUpdate) {
        await tx.contract.update({
          where: { id: existingContract.id },
          data: {
            hasSwap: newContract.hasSwap || false,
            swapAddress: newContract.hasSwap ? newContract.swapAddress?.toLowerCase() : null,
            active: newContract.active !== false,
          }
        });
        updatedCount++;
      }
    } else {
      // Create new contract
      await tx.contract.create({
        data: {
          dappId,
          address,
          hasSwap: newContract.hasSwap || false,
          swapAddress: newContract.hasSwap ? newContract.swapAddress?.toLowerCase() : null,
          active: newContract.active !== false,
        }
      });
      createdCount++;
    }
  }
};

const updateSenders = async (tx, dappId, existingSenders, newSenders) => {
  const existingMap = new Map(existingSenders.map(s => [s.address.toLowerCase(), s]));
  const newMap = new Map(newSenders.map(s => [s.address.toLowerCase(), s]));
  
  // Delete senders that are no longer in the new list
  const toDelete = existingSenders.filter(s => !newMap.has(s.address.toLowerCase()));
  if (toDelete.length > 0) {
    await tx.sender.deleteMany({
      where: { id: { in: toDelete.map(s => s.id) } }
    });
  }
  
  let createdCount = 0;
  
  // Create new senders that don't exist
  for (const newSender of newSenders) {
    const address = newSender.address.toLowerCase();
    if (!existingMap.has(address)) {
      await tx.sender.create({
        data: {
          dappId,
          address,
          active: newSender.active !== false,
        }
      });
      createdCount++;
    }
  }
};

const updateApiKeys = async (tx, dappId, existingApiKeys, newApiKeys) => {
  const existingMap = new Map(existingApiKeys.map(k => [k.key, k]));
  const newMap = new Map(newApiKeys.map(k => [k.key, k]));
  
  // Delete API keys that are no longer in the new list
  const toDelete = existingApiKeys.filter(k => !newMap.has(k.key));
  if (toDelete.length > 0) {
    await tx.apiKey.deleteMany({
      where: { id: { in: toDelete.map(k => k.id) } }
    });
  }
  
  let updatedCount = 0;
  let createdCount = 0;
  
  // Update existing API keys or create new ones
  for (const newApiKey of newApiKeys) {
    const existingApiKey = existingMap.get(newApiKey.key);
    
    if (existingApiKey) {
      // Update existing API key if name or active status changed
      const needsUpdate = 
        existingApiKey.name !== newApiKey.name ||
        existingApiKey.active !== (newApiKey.active !== false);
      
      if (needsUpdate) {
        await tx.apiKey.update({
          where: { id: existingApiKey.id },
          data: { 
            name: newApiKey.name,
            active: newApiKey.active !== false,
          }
        });
        updatedCount++;
      }
    } else {
      // Create new API key
      await tx.apiKey.create({
        data: {
          dappId,
          key: newApiKey.key,
          name: newApiKey.name,
          active: newApiKey.active !== false,
        }
      });
      createdCount++;
    }
  }
};

const updateUserAccess = async (tx, dappId, existingUserAccess, targetEmails) => {
  const existingEmails = new Set(existingUserAccess.map(access => access.user.email));
  const targetEmailsSet = new Set(targetEmails);
  
  // Remove access for users not in target list
  const toRemove = existingUserAccess.filter(access => !targetEmailsSet.has(access.user.email));
  if (toRemove.length > 0) {
    await tx.userDappAccess.deleteMany({
      where: { id: { in: toRemove.map(access => access.id) } }
    });
  }
  
  let createdCount = 0;
  
  // Add access for new users
  for (const email of targetEmails) {
    if (!existingEmails.has(email)) {
      // Get user ID for this email
      const user = await tx.user.findUnique({ 
        where: { email, isActive: true },
        select: { id: true }
      });
      
      if (user) {
        await tx.userDappAccess.create({
          data: {
            userId: user.id,
            dappId: dappId,
          }
        });
        createdCount++;
      }
    }
  }
};

const updateEmailAlerts = async (tx, dappId, existingEmailAlerts, newEmailAlerts) => {
  const existingMap = new Map(existingEmailAlerts.map(e => [e.email, e]));
  const newMap = new Map(newEmailAlerts.map(e => [e.email, e]));
  
  // Delete email alerts that are no longer in the new list
  const toDelete = existingEmailAlerts.filter(e => !newMap.has(e.email));
  if (toDelete.length > 0) {
    await tx.emailAlert.deleteMany({
      where: { id: { in: toDelete.map(e => e.id) } }
    });
  }
  
  let updatedCount = 0;
  let createdCount = 0;
  
  // Update existing email alerts or create new ones
  for (const newAlert of newEmailAlerts) {
    const existingAlert = existingMap.get(newAlert.email);
    
    if (existingAlert) {
      // Convert threshold to wei for comparison
      const newThresholdWei = ethers.parseUnits(Number(newAlert.balanceThreshold).toString(), 18).toString();
      
      // Update existing email alert if data changed
      const needsUpdate = 
        existingAlert.balanceThreshold !== newThresholdWei ||
        existingAlert.isActive !== (newAlert.isActive !== false);
      
      if (needsUpdate) {
        await tx.emailAlert.update({
          where: { id: existingAlert.id },
          data: {
            balanceThreshold: newThresholdWei,
            isActive: newAlert.isActive !== false,
          }
        });
        updatedCount++;
      }
    } else {
      // Create new email alert
      // Convert balance threshold to wei
      const thresholdNum = Number(newAlert.balanceThreshold);
      if (isNaN(thresholdNum) || thresholdNum < 0) {
        throw new Error(`Invalid balance threshold: ${newAlert.balanceThreshold}`);
      }
      const thresholdWei = ethers.parseUnits(thresholdNum.toString(), 18);
      
      await tx.emailAlert.create({
        data: {
          dappId,
          email: newAlert.email,
          balanceThreshold: thresholdWei.toString(),
          isActive: newAlert.isActive !== false,
        }
      });
      createdCount++;
    }
  }
};

module.exports = router; 