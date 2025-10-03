import { ethers } from "ethers";

type SwapConfig = {
  privateKey: string;
  rpcUrl: string;
  contractAddress: string;
  amountInUsdt: string;
  slippageBps: number;
  permitDeadlineBufferSeconds: number;
  permitDomainVersion: string;
};

const config: SwapConfig = {
  privateKey: "your_private_key",
  rpcUrl: "https://public-en-kairos.node.kaia.io",
  contractAddress: "0x58ECAaE13C4Fc732261fBe50De9d3Aa2591b67E5",
  amountInUsdt: "0.1",
  slippageBps: 500, // 5%
  permitDeadlineBufferSeconds: 600,
  permitDomainVersion: "1",
};

const erc20MetadataAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
];

const gaslessSwapAbi = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_uniswapRouter",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_usdtToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_wkaiaToken",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "OwnableInvalidOwner",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "OwnableUnauthorizedAccount",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardReentrantCall",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        }
      ],
      "name": "SafeERC20FailedOperation",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "tokenIn",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "tokenOut",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "executor",
          "type": "address"
        }
      ],
      "name": "GaslessSwapExecuted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address payable",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "emergencyRecoverNativeToken",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenIn",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenOut",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        },
        {
          "internalType": "uint8",
          "name": "v",
          "type": "uint8"
        },
        {
          "internalType": "bytes32",
          "name": "r",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "s",
          "type": "bytes32"
        }
      ],
      "name": "executeSwapWithPermit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenIn",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenOut",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        }
      ],
      "name": "getExpectedOutput",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "maxUsdtAmount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "renounceOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "newMax",
          "type": "uint256"
        }
      ],
      "name": "setMaxUsdtAmount",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newRouter",
          "type": "address"
        }
      ],
      "name": "setRouter",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newUsdt",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "newWkaia",
          "type": "address"
        }
      ],
      "name": "setTokens",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "uniswapRouter",
      "outputs": [
        {
          "internalType": "contract IUniswapV2Router02",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "usdtToken",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "wkaiaToken",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "stateMutability": "payable",
      "type": "receive"
    }
  ];

async function buildPermitSignature(
  token: ethers.Contract,
  owner: ethers.Wallet,
  spender: string,
  value: bigint,
  deadline: number,
  domainVersion: string
) {
  const [name, nonce, network] = await Promise.all([
    token.name(),
    token.nonces(await owner.getAddress()),
    owner.provider!.getNetwork(),
  ]);

  const domain = {
    name,
    version: domainVersion,
    chainId: Number(network.chainId),
    verifyingContract: await token.getAddress(),
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    owner: await owner.getAddress(),
    spender,
    value,
    nonce,
    deadline,
  };

  const signature = ethers.Signature.from(await owner.signTypedData(domain, types, message));
  return { signature, nonce };
}

async function main() {
  const executorPrivateKey = config.privateKey;
  const userPrivateKey = process.env.USER_PRIVATE_KEY ?? executorPrivateKey;

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const executor = new ethers.Wallet(executorPrivateKey, provider);
  const user = new ethers.Wallet(userPrivateKey, provider);

  const swap = new ethers.Contract(config.contractAddress, gaslessSwapAbi, executor);

  const [usdtAddress, wkaiaAddress, maxUsdtAmount] = await Promise.all([
    swap.usdtToken(),
    swap.wkaiaToken(),
    swap.maxUsdtAmount(),
  ]);

  const usdtToken = new ethers.Contract(usdtAddress, erc20MetadataAbi, provider);
  const wkaiaToken = new ethers.Contract(wkaiaAddress, erc20MetadataAbi, provider);

  const [usdtDecimals, wkaiaDecimals, usdtSymbol, wkaiaSymbol] = await Promise.all([
    usdtToken.decimals(),
    wkaiaToken.decimals(),
    usdtToken.symbol(),
    wkaiaToken.symbol(),
  ]);

  const amountIn = ethers.parseUnits(config.amountInUsdt, usdtDecimals);
  if (amountIn > maxUsdtAmount) {
    throw new Error(
      `amountIn (${config.amountInUsdt} ${usdtSymbol}) exceeds contract cap ${ethers.formatUnits(maxUsdtAmount, usdtDecimals)} ${usdtSymbol}`
    );
  }

  const expectedOut = await swap.getExpectedOutput(usdtAddress, wkaiaAddress, amountIn);
  const slippageNumerator = BigInt(10_000 - config.slippageBps);
  const amountOutMin = (expectedOut * slippageNumerator) / 10_000n;
  if (amountOutMin === 0n) {
    throw new Error("amountOutMin computed to zero. Increase amount or decrease slippage.");
  }

  const deadline = Math.floor(Date.now() / 1000) + config.permitDeadlineBufferSeconds;
  const { signature, nonce } = await buildPermitSignature(
    usdtToken,
    user,
    await swap.getAddress(),
    amountIn,
    deadline,
    config.permitDomainVersion
  );

  const [userBalance, executorBalance] = await Promise.all([
    usdtToken.balanceOf(await user.getAddress()),
    provider.getBalance(await executor.getAddress()),
  ]);

  console.log("Executor:", await executor.getAddress(), "Balance (KAIA):", ethers.formatEther(executorBalance));
  console.log("User:", await user.getAddress(), `Balance (${usdtSymbol}):`, ethers.formatUnits(userBalance, usdtDecimals));
  console.log(`Swapping ${ethers.formatUnits(amountIn, usdtDecimals)} ${usdtSymbol}`);
  console.log("Expected output:", ethers.formatUnits(expectedOut, wkaiaDecimals), wkaiaSymbol);
  console.log("Minimum output:", ethers.formatUnits(amountOutMin, wkaiaDecimals), wkaiaSymbol);
  console.log("Permit signature:", { v: signature.v, r: signature.r, s: signature.s, nonce: nonce.toString(), deadline });

  const balanceBefore = await provider.getBalance(await user.getAddress());
  console.log("Balance before:", ethers.formatEther(balanceBefore));
  const tx = await swap.executeSwapWithPermit(
    await user.getAddress(),
    usdtAddress,
    wkaiaAddress,
    amountIn,
    amountOutMin,
    deadline,
    signature.v,
    signature.r,
    signature.s
  );

  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Swap confirmed in block", receipt?.blockNumber);
  const balanceAfter = await provider.getBalance(await user.getAddress());
  console.log("Balance after:", ethers.formatEther(balanceAfter));
  const gasUsed = receipt?.gasUsed;
  const gasPrice = receipt?.gasPrice;
  const usedFee = BigInt(gasUsed) * BigInt(gasPrice);
  console.log("Used fee:", usedFee);
}

main().catch((error) => {
  console.error("runRealSwap failed:", error);
  process.exitCode = 1;
});
