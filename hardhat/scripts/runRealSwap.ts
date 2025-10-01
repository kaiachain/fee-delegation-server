import { ethers } from "hardhat";

/**
 * Update these values before running the script.
 * Numeric strings must be encoded in wei.
 */
const config = {
  executorPrivateKey: "0x4150dca5e411bad248e479922f8b35aa28ad65219185cc471eb51196df5d91b5", // pays gas
  userPrivateKey: "0x4150dca5e411bad248e479922f8b35aa28ad65219185cc471eb51196df5d91b5", // signs permit (can be different)
  contractAddress: "0x878c2c46D12ba04B4c6be3a1aAc9CA5dC7D126cD",
  tokenIn: "0xcb00ba2cab67a3771f9ca1fa48fda8881b457750", // TEST token with permit
  tokenOut: "0x043c471bEe060e00A56CcD02c0Ca286808a5A436", // WKAIA
  amountIn: "100000000000000000", // 0.1 TEST (18 decimals)
  amountOutMin: "1", // adjust to slippage tolerance
  permitDeadlineBufferSeconds: 600,
  permitDomainVersion: "1",
};

function assertConfigured() {
  const requiredHex = [
    config.executorPrivateKey,
    config.userPrivateKey,
    config.contractAddress,
    config.tokenIn,
    config.tokenOut,
  ];
  if (requiredHex.some((value) => !value || value === ethers.ZeroAddress)) {
    throw new Error("Ensure private keys and addresses in config are populated.");
  }
  if (config.amountIn === "0" || config.amountOutMin === "0") {
    throw new Error("Set non-zero amountIn and amountOutMin in wei.");
  }
}

async function main() {
  assertConfigured();

  const provider = ethers.provider;
  const executorWallet = new ethers.Wallet(config.executorPrivateKey, provider);
  const permitWallet = new ethers.Wallet(config.userPrivateKey, provider);

  const contract = ethers.getAddress(config.contractAddress);
  const tokenIn = ethers.getAddress(config.tokenIn);
  const tokenOut = ethers.getAddress(config.tokenOut);
  const userAddress = await permitWallet.getAddress();

  const amountIn = BigInt(config.amountIn);
  const amountOutMin = BigInt(config.amountOutMin);
  const deadline = Math.floor(Date.now() / 1000) + config.permitDeadlineBufferSeconds;

  console.log("Executor:", executorWallet.address);
  console.log("Permit signer (user):", userAddress);

  const erc20PermitAbi = [
    "function name() view returns (string)",
    "function nonces(address owner) view returns (uint256)",
  ];
  const permitToken = new ethers.Contract(tokenIn, erc20PermitAbi, permitWallet);

  const [tokenName, nonce, network] = await Promise.all([
    permitToken.name(),
    permitToken.nonces(userAddress),
    provider.getNetwork(),
  ]);

  const domain = {
    name: tokenName,
    version: config.permitDomainVersion,
    chainId: Number(network.chainId),
    verifyingContract: tokenIn,
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
    owner: userAddress,
    spender: contract,
    value: amountIn,
    nonce,
    deadline,
  };

  const signatureBytes = await permitWallet.signTypedData(domain, types, message);
  const signature = ethers.Signature.from(signatureBytes);

  console.log("Permit signature:", {
    v: signature.v,
    r: signature.r,
    s: signature.s,
    nonce: nonce.toString(),
    deadline,
  });

  const swap = await ethers.getContractAt("GaslessERC20PermitSwap", contract, executorWallet);
  const tx = await swap.executeSwapWithPermit(
    userAddress,
    tokenIn,
    tokenOut,
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
}

main().catch((error) => {
  console.error("runRealSwap failed:", error);
  process.exitCode = 1;
});
