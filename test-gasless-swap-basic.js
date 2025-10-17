const { JsonRpcProvider, Wallet } = require('@kaiachain/ethers-ext/v6');
const { Contract, parseUnits, formatUnits, Signature } = require('ethers');

async function fetchJson(url, init) {
  if (typeof fetch !== 'undefined') {
    return fetch(url, init);
  }
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(url, init);
}

const CONFIG = {
  rpcUrl: process.env.TEST_RPC_URL || 'https://public-en-kairos.node.kaia.io',
  serverUrl: process.env.TEST_SERVER_URL || 'http://localhost:3000',
  privateKey: process.env.TEST_USER_PRIVATE_KEY || '0x4150dca5e411bad248e479922f8b35aa28ad65219185cc471eb51196df5d91b5',
  contractAddress: (process.env.GASLESS_SWAP_CONTRACT_ADDRESS || '0x5bdff0c890923f697677f3815a82a0acde0d405e').toLowerCase(),
  tokenIn: (process.env.GASLESS_SWAP_TOKEN_IN || '').toLowerCase(),
  tokenOut: (process.env.GASLESS_SWAP_TOKEN_OUT || '').toLowerCase(),
  amountIn: process.env.TEST_SWAP_AMOUNT_IN || '0.01',
  slippageBps: Number(process.env.TEST_SWAP_SLIPPAGE_BPS || 50),
  permitDeadlineSeconds: Number(process.env.TEST_SWAP_DEADLINE || 600),
};

const GASLESS_SWAP_ABI = [
  'function usdtToken() view returns (address)',
  'function wkaiaToken() view returns (address)',
  'function maxUsdtAmount() view returns (uint256)',
  'function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256)',
  'function executeSwapWithPermit(address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
];

const ERC20_METADATA_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function nonces(address owner) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

async function buildPermitSignature({ token, owner, spender, value, deadline, domainVersion = '1' }) {
  const [name, version, network, verifyingContract, nonce] = await Promise.all([
    token.name(),
    Promise.resolve(domainVersion),
    owner.provider.getNetwork(),
    token.getAddress(),
    token.nonces(owner.address),
  ]);

  const domain = {
    name,
    version,
    chainId: Number(network.chainId),
    verifyingContract,
  };

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const message = {
    owner: owner.address,
    spender,
    value,
    nonce,
    deadline,
  };

  return Signature.from(await owner.signTypedData(domain, types, message));
}

async function main() {
  console.log('🚀 Simple gasless swap test');

  if (!CONFIG.contractAddress) {
    throw new Error('TEST_SWAP_CONTRACT (or CONFIG.contractAddress) must be set');
  }

  const provider = new JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new Wallet(CONFIG.privateKey, provider);
  const swap = new Contract(CONFIG.contractAddress, GASLESS_SWAP_ABI, provider);

  const [tokenInAddress, tokenOutAddress, maxUsdtAmount] = await Promise.all([
    swap.usdtToken(),
    swap.wkaiaToken(),
    swap.maxUsdtAmount(),
  ]);

  const tokenIn = new Contract(tokenInAddress, ERC20_METADATA_ABI, provider);
  const tokenOut = new Contract(tokenOutAddress, ERC20_METADATA_ABI, provider);

  const [tokenInDecimals, tokenOutDecimals, tokenInSymbol, tokenOutSymbol] = await Promise.all([
    tokenIn.decimals(),
    tokenOut.decimals(),
    tokenIn.symbol(),
    tokenOut.symbol(),
  ]);

  const amountIn = parseUnits(CONFIG.amountIn, tokenInDecimals);
  if (amountIn > maxUsdtAmount) {
    throw new Error(`Configured amount (${CONFIG.amountIn} ${tokenInSymbol}) exceeds contract cap (${formatUnits(maxUsdtAmount, tokenInDecimals)} ${tokenInSymbol})`);
  }

  const expectedOut = await swap.getExpectedOutput(tokenInAddress, tokenOutAddress, amountIn);
  const amountOutMin = (expectedOut * BigInt(10_000 - CONFIG.slippageBps)) / 10_000n;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + CONFIG.permitDeadlineSeconds);
  const signature = await buildPermitSignature({
    token: tokenIn,
    owner: wallet,
    spender: CONFIG.contractAddress,
    value: amountIn,
    deadline,
  });

  const payload = {
    swap: {
      user: wallet.address,
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn: amountIn.toString(),
      amountOutMin: amountOutMin.toString(),
      deadline: deadline.toString(),
    },
    permitSignature: signature.serialized,
  };

//   console.log('Payload:', JSON.stringify(payload, null, 2));
//   return

  console.log('From:', wallet.address);
  console.log('Swap amount:', formatUnits(amountIn, tokenInDecimals), tokenInSymbol);
  console.log('Minimum out:', formatUnits(amountOutMin, tokenOutDecimals), tokenOutSymbol);
  console.log('Posting to:', `${CONFIG.serverUrl}/api/gasFreeSwapKaia`);

  const balanceBefore = await provider.getBalance(wallet.address);
  const response = await fetchJson(`${CONFIG.serverUrl}/api/gasFreeSwapKaia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  console.log('HTTP status:', response.status);
  console.log(JSON.stringify(body, null, 2));

  if (response.ok && body.status) {
    console.log('🎉 Gasless swap request succeeded');
  } else {
    console.error('❌ Gasless swap request failed');
  }

  const balanceAfter = await provider.getBalance(wallet.address);
  console.log('Balance before:', formatUnits(balanceBefore, tokenInDecimals));
  console.log('Balance after:', formatUnits(balanceAfter, tokenInDecimals));
  console.log('Balance difference:', formatUnits(balanceAfter - balanceBefore, tokenInDecimals), 'KAIA');
  
}

main().catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});

