const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');
const { parseKaia } = require('@kaiachain/ethers-ext/v6');

const prisma = new PrismaClient();

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const RESPONSE_MAP = {
  SUCCESS: { message: "Request was successful", status: 200 },
  REVERTED: { message: "Transaction reverted", status: 200 },
  BAD_REQUEST: { message: "Bad request", status: 400 },
  METHOD_NOT_ALLOWED: { message: "Method not allowed", status: 405 },
  INTERNAL_ERROR: { message: "Internal server error", status: 500 },
  NOT_FOUND: { message: "Resource not found", status: 404 },
  CONFLICT: { message: "Resource already exists", status: 409 },
  UNAUTHORIZED: { message: "Unauthorized access", status: 401 },
};

const createResponse = (res, type, data, requestId = null) => {
  const { message, status } = RESPONSE_MAP[type];
  const payload = {
    message,
    data,
    error: type !== "SUCCESS" ? type : undefined,
    status: type === "SUCCESS",
    requestId: requestId || undefined
  };
  return res.status(status).json(payload);
};

// Helper function to sanitize error messages by removing RPC URLs
const sanitizeErrorMessage = (errorMessage, requestId = null) => {
  if (!errorMessage) return errorMessage;
  
  // Remove RPC URLs from error messages for client responses
  const sanitized = errorMessage
    .replace(/https?:\/\/[^\s,}"]+/g, '[RPC_URL_HIDDEN]')
    .replace(/"requestUrl"\s*:\s*"[^"]+"/g, '"requestUrl": "[RPC_URL_HIDDEN]"')
    .replace(/requestUrl[^,}]+/g, 'requestUrl: "[RPC_URL_HIDDEN]"');
    
  return sanitized;
};

// Helper function to log errors cleanly without overwhelming output
const logError = (error, requestId, context = '') => {
  if (!error || !requestId) return;
  
  const contextStr = context ? ` - ${context}` : '';
  
  if (error instanceof Error) {
    // For Error objects, log the essential info cleanly
    console.error(`Request ID: ${requestId}${contextStr} - ${error.name}: ${error.message}`);
    if (error.code) {
      console.error(`Request ID: ${requestId}${contextStr} - Error code: ${error.code}`);
    }
    // Only log stack trace if it's a critical error (not parsing/validation errors)
    if (context && !context.toLowerCase().includes('parsing') && !context.toLowerCase().includes('validation')) {
      console.error(`Request ID: ${requestId}${contextStr} - Stack:`, error.stack);
    }
  } else if (typeof error === 'string') {
    console.error(`Request ID: ${requestId}${contextStr} - ${error}`);
  } else if (typeof error === 'object') {
    console.error(`Request ID: ${requestId}${contextStr} - Error:`, error);
  }
};

// Helper function to get a clean error message for client responses
const getCleanErrorMessage = (error) => {
  let message;
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error?.message) {
    message = error.message;
  } else if (typeof error === 'object' && error?.error?.message) {
    message = error.error.message;
  } else {
    message = 'An unknown error occurred';
  }
  
  // Sanitize the message to remove RPC URLs for client response
  return sanitizeErrorMessage(message);
};

const checkWhitelistedContractsWithoutAPIkey = async (address) => {
  if (!address) {
    return false;
  }
  const contract = await prisma.contract.findFirst({
    where: { 
      address,
      active: true 
    },
    include: {
      dapp: {
        include: {
          apiKeys: true
        }
      }
    }
  });
  
  // Return false if contract doesn't exist or if DApp has API keys configured
  if (!contract || (contract.dapp.apiKeys && contract.dapp.apiKeys.length > 0)) {
    return false;
  }
  
  return true;
};

const checkWhitelistedSendersWithoutAPIkey = async (address) => {
  if (!address) {
    return false;
  }
  const sender = await prisma.sender.findFirst({
    where: { 
      address,
      active: true 
    },
    include: {
      dapp: {
        include: {
          apiKeys: true
        }
      }
    }
  });
  
  // Return false if sender doesn't exist or if DApp has API keys configured
  if (!sender || (sender.dapp.apiKeys && sender.dapp.apiKeys.length > 0)) {
    return false;
  }
  
  return true;
};

const getDappfromContract = async (address) => {
  const contract = await prisma.contract.findFirst({
    where: { 
      address,
      active: true 
    },
  });
  if (!contract) {
    return null;
  }
  
  // Get DApp and check if it has API keys configured
  const dapp = await prisma.dApp.findUnique({
    where: { id: contract?.dappId },
    include: {
      contracts: true,
      apiKeys: true,
    },
  });
  
  // Skip DApps that have API keys configured
  if (dapp && dapp.apiKeys && dapp.apiKeys.length > 0) {
    return null;
  }
  
  return dapp;
};

const getDappfromSender = async (address) => {
  const sender = await prisma.sender.findFirst({
    where: { 
      address,
      active: true 
    },
  });
  if (!sender) {
    return null;
  }
  
  // Get DApp and check if it has API keys configured
  const dapp = await prisma.dApp.findUnique({
    where: { id: sender?.dappId },
    include: {
      apiKeys: true,
    },
  });
  
  // Skip DApps that have API keys configured
  if (dapp && dapp.apiKeys && dapp.apiKeys.length > 0) {
    return null;
  }
  
  return dapp;
};

const isEnoughBalance = (balance) => {
  return balance > parseKaia("0.1") ? true : false;
};

const updateDappWithFee = async (dapp, fee) => {
  const balance = BigInt(dapp?.balance) - fee;
  const totalUsed = BigInt(dapp?.totalUsed) + fee;
  await prisma.dApp.update({
    where: { id: dapp.id },
    data: { balance: balance.toString(), totalUsed: totalUsed.toString() },
  });
};

// ABI Definitions for swap validation
const swapAbi = [
  "function multicall(uint256 deadline, bytes[] data)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to)",
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96))",
];

const validateSwapTransaction = async (dapp, tx) => {
  try {
    let isCapybaraSwap = false;
    let isDragonSwap = false;
    if (dapp?.name?.toLowerCase() === "dragonswap") {
      isDragonSwap = true;
    } else if (dapp?.name?.toLowerCase() === "capybara") {
      isCapybaraSwap = true;
    }

    if (isDragonSwap || isCapybaraSwap) {
      console.log((dapp.name || "Unknown") + " validateSwapTransaction Details:");
      console.log(JSON.stringify(tx));
    }

    if (!dapp.contracts?.some((contract) => contract.hasSwap)) {
      console.log("Not a swap transaction, proceed");
      return true; // Not a swap transaction, proceed
    }

    const toAddress = tx.to?.toLowerCase();
    const swapContract = dapp.contracts.find(
      (contract) =>
        contract.hasSwap && contract.address.toLowerCase() === toAddress
    );

    if (!swapContract) {
      console.log("No swap contract found, proceed");
      return true; // Not a swap transaction, proceed
    }

    if (isCapybaraSwap) {
      try {
        const iface = new ethers.Interface(swapAbi);
        const decodedMulticall = iface.decodeFunctionData("multicall", tx.data || "");
        const dataArray = decodedMulticall[1];

        for (const call of dataArray) {
          const selector = call.slice(0, 10);

          switch (selector.toLowerCase()) {
            case iface
              .getFunction("swapExactTokensForTokens")
              ?.selector.toLowerCase():
              console.log("Executing swapExactTokensForTokens");
              try {
                const decoded = iface.decodeFunctionData(
                  "swapExactTokensForTokens",
                  call
                );
                const path = decoded.path || decoded[2];
                const tokenIn = path[0];
                const tokenOut = path[path.length - 1];

                return (
                  tokenOut.toLowerCase() ===
                    swapContract.swapAddress?.toLowerCase() ||
                  tokenIn.toLowerCase() ===
                    swapContract.swapAddress?.toLowerCase()
                );
              } catch (err) {
                console.error(
                  "Failed to decode swapExactTokensForTokens capybaraswap transaction:",
                  err
                );
                return false;
              }

            case iface.getFunction("exactInputSingle")?.selector.toLowerCase():
              console.log("Executing exactInputSingle");
              try {
                const [params] = iface.decodeFunctionData(
                  "exactInputSingle",
                  call
                );
                const tokenIn = params.tokenIn;
                const tokenOut = params.tokenOut;

                return (
                  tokenOut.toLowerCase() ===
                    swapContract.swapAddress?.toLowerCase() ||
                  tokenIn.toLowerCase() ===
                    swapContract.swapAddress?.toLowerCase()
                );
              } catch (err) {
                console.error(
                  "Failed to decode exactInputSingle capybaraswap transaction:",
                  err
                );
                return false;
              }

            default:
              console.error("Unknown selector:", selector);
              return false;
          }
        }
      } catch (error) {
        console.error("Failed to validate capybaraswap transaction:", error);
        return false;
      }
    } else if (isDragonSwap) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to validate swap transaction:", error);
    return false;
  }
};

const checkWhitelistedAndGetDapp = async (targetContract, sender) => {
  if (!targetContract && !sender) {
    return { isWhitelisted: false, dapp: null };
  }

  // Single query to check both contract and sender, and get DApp info
  const result = await prisma.$transaction(async (tx) => {
    // Check contract first
    if (targetContract) {
      const contract = await tx.contract.findFirst({
        where: { 
          address: targetContract,
          active: true 
        },
        include: {
          dapp: {
            include: {
              apiKeys: true,
              contracts: true
            }
          }
        }
      });

      if (contract && (!contract.dapp.apiKeys || contract.dapp.apiKeys.length === 0)) {
        return { isWhitelisted: true, dapp: contract.dapp };
      }
    }

    // Check sender if contract not found or DApp has API keys
    if (sender) {
      const senderRecord = await tx.sender.findFirst({
        where: { 
          address: sender,
          active: true 
        },
        include: {
          dapp: {
            include: {
              apiKeys: true,
              contracts: true
            }
          }
        }
      });

      if (senderRecord && (!senderRecord.dapp.apiKeys || senderRecord.dapp.apiKeys.length === 0)) {
        return { isWhitelisted: true, dapp: senderRecord.dapp };
      }
    }

    return { isWhitelisted: false, dapp: null };
  });

  return result;
};

const checkDappHasApiKeys = async (dappId) => {
  const dapp = await prisma.dApp.findUnique({
    where: { id: dappId },
    include: {
      apiKeys: true
    }
  });
  
  return dapp && dapp.apiKeys && dapp.apiKeys.length > 0;
};

const checkContractExistsForNoApiKeyDapps = async (address) => {
  // Check if contract exists in any DApp that doesn't have API keys
  const existingContract = await prisma.contract.findFirst({
    where: {
      address: address.toLowerCase(),
      active: true,
      dapp: {
        apiKeys: {
          none: {} // DApp has no API keys
        }
      }
    },
    include: {
      dapp: {
        include: {
          apiKeys: true
        }
      }
    }
  });
  
  return existingContract;
};

const checkSenderExistsForNoApiKeyDapps = async (address) => {
  // Check if sender exists in any DApp that doesn't have API keys
  const existingSender = await prisma.sender.findFirst({
    where: {
      address: address.toLowerCase(),
      active: true,
      dapp: {
        apiKeys: {
          none: {} // DApp has no API keys
        }
      }
    },
    include: {
      dapp: {
        include: {
          apiKeys: true
        }
      }
    }
  });
  
  return existingSender;
};

const checkContractExistsForApiKeyDapps = async (address) => {
  // Check if contract exists in any DApp that has API keys
  const existingContract = await prisma.contract.findFirst({
    where: {
      address: address.toLowerCase(),
      active: true,
      dapp: {
        apiKeys: {
          some: {} // DApp has at least one API key
        }
      }
    },
    include: {
      dapp: {
        include: {
          apiKeys: true
        }
      }
    }
  });
  
  return existingContract;
};

const checkSenderExistsForApiKeyDapps = async (address) => {
  // Check if sender exists in any DApp that has API keys
  const existingSender = await prisma.sender.findFirst({
    where: {
      address: address.toLowerCase(),
      active: true,
      dapp: {
        apiKeys: {
          some: {} // DApp has at least one API key
        }
      }
    },
    include: {
      dapp: {
        include: {
          apiKeys: true
        }
      }
    }
  });
  
  return existingSender;
};

const getDappByApiKey = async (apiKey) => {
  if (!apiKey) {
    return null;
  }

  const dapp = await prisma.dApp.findFirst({
    where: {
      apiKeys: {
        some: {
          key: apiKey.toLowerCase(),
          active: true
        }
      },
      active: true
    },
    include: {
      apiKeys: {
        where: {
          key: apiKey.toLowerCase(),
          active: true
        }
      }
    }
  });

  return dapp;
};

/**
 * Get accessible DApp IDs for a user based on their role and email
 * @param {string} userRole - User's role ('super_admin', 'editor', etc.)
 * @param {string} userEmail - User's email address
 * @returns {Promise<string[]|null>} Array of DApp IDs user has access to, or null if super_admin (all access)
 */
const getUserAccessibleDappIds = async (userRole, userEmail) => {
  // Super admins have access to all DApps
  if (userRole === 'super_admin') {
    return null; // Null indicates all access
  }
  
  // Get DApp IDs that the user has access to
  const userAccessDapps = await prisma.userDappAccess.findMany({
    where: {
      user: {
        email: userEmail,
        isActive: true
      }
    },
    select: {
      dappId: true
    }
  });
  
  return userAccessDapps.map(access => access.dappId);
};

/**
 * Apply DApp access filtering to a Prisma where clause
 * @param {Object} whereClause - Existing Prisma where clause (will be modified)
 * @param {string} userRole - User's role ('super_admin', 'editor', etc.)
 * @param {string} userEmail - User's email address
 * @param {string} dappIdField - Field name for DApp ID (default: 'dappId')
 * @returns {Promise<Object>} The modified where clause (same object reference)
 */
const applyDappAccessFilter = async (whereClause, userRole, userEmail, dappIdField = 'dappId') => {
  const accessibleDappIds = await getUserAccessibleDappIds(userRole, userEmail);
  
  // Super admins see all - no filtering needed
  if (accessibleDappIds === null) {
    return whereClause;
  }
  
  // Apply DApp access filtering by modifying the whereClause object
  if (accessibleDappIds.length > 0) {
    whereClause[dappIdField] = {
      in: accessibleDappIds
    };
  } else {
    // User has no DApp access - return impossible condition
    whereClause[dappIdField] = {
      in: [] // Empty array means no results
    };
  }
  
  return whereClause;
};

/**
 * Check if user has access to a specific DApp
 * @param {string} dappId - DApp ID to check access for
 * @param {string} userRole - User's role ('super_admin', 'editor', etc.)
 * @param {string} userEmail - User's email address
 * @returns {Promise<boolean>} True if user has access, false otherwise
 */
const hasUserDappAccess = async (dappId, userRole, userEmail) => {
  // Super admins have access to all DApps
  if (userRole === 'super_admin') {
    return true;
  }
  
  // Check if user has access to this specific DApp
  const userAccess = await prisma.userDappAccess.findFirst({
    where: {
      dappId,
      user: {
        email: userEmail,
        isActive: true
      }
    }
  });
  
  return !!userAccess;
};

/**
 * Validate user access to a specific email alert by ID
 * @param {string} emailAlertId - Email alert ID to check access for
 * @param {string} userRole - User's role ('super_admin', 'editor', etc.)
 * @param {string} userEmail - User's email address
 * @returns {Promise<{success: boolean, dappId?: string, error?: string}>} Validation result with DApp ID if successful
 */
const validateEmailAlertAccess = async (emailAlertId, userRole, userEmail) => {
  // Find the email alert and get its DApp ID
  const emailAlert = await prisma.emailAlert.findUnique({
    where: { id: emailAlertId },
    select: { dappId: true }
  });
  
  if (!emailAlert) {
    return { success: false, error: "Email alert not found" };
  }
  
  // Check if user has access to this DApp
  const hasAccess = await hasUserDappAccess(emailAlert.dappId, userRole, userEmail);
  if (!hasAccess) {
    return { success: false, error: "You don't have access to this email alert" };
  }
  
  return { success: true, dappId: emailAlert.dappId };
};

module.exports = {
  createResponse,
  sanitizeErrorMessage,
  logError,
  getCleanErrorMessage,
  checkWhitelistedContractsWithoutAPIkey,
  checkWhitelistedSendersWithoutAPIkey,
  getDappfromContract,
  getDappfromSender,
  isEnoughBalance,
  updateDappWithFee,
  validateSwapTransaction,
  checkWhitelistedAndGetDapp,
  checkDappHasApiKeys,
  checkContractExistsForNoApiKeyDapps,
  checkSenderExistsForNoApiKeyDapps,
  checkContractExistsForApiKeyDapps,
  checkSenderExistsForApiKeyDapps,
  getDappByApiKey,
  getUserAccessibleDappIds,
  applyDappAccessFilter,
  hasUserDappAccess,
  validateEmailAlertAccess,
}; 