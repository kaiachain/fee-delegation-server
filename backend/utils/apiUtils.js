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

const createResponse = (res, type, data) => {
  const { message, status } = RESPONSE_MAP[type];
  const payload = {
    message,
    data,
    error: type !== "SUCCESS" ? type : undefined,
    status: type === "SUCCESS"
  };
  return res.status(status).json(payload);
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

module.exports = {
  createResponse,
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
}; 