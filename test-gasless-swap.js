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
  contractAddress: (process.env.GASLESS_SWAP_CONTRACT_ADDRESS || '0x600476503ce147213f2AA20B3eeFD51c8bf375B6').toLowerCase(),
  tokenIn: (process.env.GASLESS_SWAP_TOKEN_IN || '0xcb00ba2cab67a3771f9ca1fa48fda8881b457750').toLowerCase(),
  tokenOut: (process.env.GASLESS_SWAP_TOKEN_OUT || '0x043c471bee060e00a56ccd02c0ca286808a5a436').toLowerCase(),
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
  const [name, version, chainId, verifyingContract, nonce] = await Promise.all([
    token.name(),
    Promise.resolve(domainVersion),
    owner.provider.getNetwork().then((network) => Number(network.chainId)),
    token.getAddress(),
    token.nonces(owner.address),
  ]);

  const domain = { name, version, chainId, verifyingContract: await token.getAddress() };
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

  return Signature.from(await owner.signTypedData(domain, types, message)).serialized;
}

const MAX_GAS_PRICE = 50n * 10n ** 9n;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

async function runScenario({
  label,
  makePayload,
  expectStatus,
  expectSuccess,
  expectedDataIncludes,
  expectedMessageIncludes,
  optional = false,
}) {
  console.log(`\n=== ${label} ===`);

  const payload = await makePayload();
  if (payload === null) {
    if (optional) {
      console.log('Scenario skipped (preconditions not met).');
      return;
    }
    throw new Error(`${label} did not provide payload`);
  }

  const response = await fetchJson(`${CONFIG.serverUrl}/api/gasFreeSwapKaia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  console.log(`Status: ${response.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (typeof expectStatus === 'number' && response.status !== expectStatus) {
    throw new Error(`${label} expected HTTP ${expectStatus} but received ${response.status}`);
  }

  if (expectSuccess) {
    if (!response.ok || body.status !== true) {
      throw new Error(`${label} expected success but failed`);
    }
  } else if (expectStatus !== undefined) {
    if (response.ok && body.status === true) {
      throw new Error(`${label} expected failure but succeeded`);
    }
  }

  if (expectedDataIncludes) {
    const dataString = `${body?.data ?? ''}`.toLowerCase();
    if (!dataString.includes(expectedDataIncludes.toLowerCase())) {
      throw new Error(`${label} expected data to include "${expectedDataIncludes}"`);
    }
  }

  if (expectedMessageIncludes) {
    const messageSource = `${body?.message ?? ''}${body?.error ?? ''}`.toLowerCase();
    if (!messageSource.includes(expectedMessageIncludes.toLowerCase())) {
      throw new Error(`${label} expected message to include "${expectedMessageIncludes}"`);
    }
  }
}

async function main() {
  if (!CONFIG.contractAddress || !CONFIG.tokenIn || !CONFIG.tokenOut) {
    throw new Error('Please set TEST_SWAP_CONTRACT, TEST_SWAP_TOKEN_IN, TEST_SWAP_TOKEN_OUT environment variables.');
  }

  const provider = new JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new Wallet(CONFIG.privateKey, provider);

  const swapContract = new Contract(CONFIG.contractAddress, GASLESS_SWAP_ABI, provider);
  const tokenInContract = new Contract(CONFIG.tokenIn, ERC20_METADATA_ABI, provider);
  const tokenOutContract = new Contract(CONFIG.tokenOut, ERC20_METADATA_ABI, provider);

  const tokenInDecimals = await tokenInContract.decimals();
  const tokenOutDecimals = await tokenOutContract.decimals();
  const [tokenInSymbol, tokenOutSymbol, maxUsdtAmount] = await Promise.all([
    tokenInContract.symbol(),
    tokenOutContract.symbol(),
    swapContract.maxUsdtAmount(),
  ]);

  const amountIn = parseUnits(CONFIG.amountIn, tokenInDecimals);
  const expectedOut = await swapContract.getExpectedOutput(CONFIG.tokenIn, CONFIG.tokenOut, amountIn);
  const amountOutMin = (expectedOut * BigInt(10_000 - CONFIG.slippageBps)) / 10_000n;

  console.log('Test user:', wallet.address);
  console.log('Amount in:', formatUnits(amountIn, tokenInDecimals), tokenInSymbol);
  console.log('Min output:', formatUnits(amountOutMin, tokenOutDecimals), tokenOutSymbol);
  console.log('Contract max USDT amount:', formatUnits(maxUsdtAmount, tokenInDecimals), tokenInSymbol);
  console.log('Contract address:', CONFIG.contractAddress);
  console.log('Expected tokenIn:', CONFIG.tokenIn);
  console.log('Expected tokenOut:', CONFIG.tokenOut);

  async function buildBasePayload({
    amountInOverride = amountIn,
    amountOutMinOverride = amountOutMin,
    deadlineDeltaSeconds = CONFIG.permitDeadlineSeconds,
    signatureOverride,
  } = {}) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineDeltaSeconds);

    const signature =
      signatureOverride ||
      (await buildPermitSignature({
        token: tokenInContract,
        owner: wallet,
        spender: CONFIG.contractAddress,
        value: amountInOverride,
        deadline,
      }));

    return {
      swap: {
        user: wallet.address,
        tokenIn: CONFIG.tokenIn,
        tokenOut: CONFIG.tokenOut,
        amountIn: amountInOverride.toString(),
        amountOutMin: amountOutMinOverride.toString(),
        deadline: deadline.toString(),
      },
      permitSignature: signature,
    };
  }

  const basePayload = await buildBasePayload();
  let successfulPayload;

  const gasData = await provider.getFeeData().catch(() => null);

  await runScenario({
    label: 'Happy path',
    expectStatus: 200,
    expectSuccess: true,
    makePayload: async () => {
      const payload = await buildBasePayload();
      successfulPayload = deepClone(payload);
      return payload;
    },
  });

  const scenarios = [
    {
      label: 'Missing body',
      expectStatus: 400,
      expectedDataIncludes: 'swap and permitSignature are required',
      makePayload: async () => ({}),
    },
    {
      label: 'Missing swap fields',
      expectStatus: 400,
      expectedDataIncludes: 'Missing required swap fields',
      makePayload: async () => {
        const payload = await buildBasePayload();
        delete payload.swap.amountIn;
        return payload;
      },
    },
    {
      label: 'Unexpected extra field',
      expectStatus: 400,
      expectedDataIncludes: 'swap and permitSignature are required',
      makePayload: async () => ({ ...(await buildBasePayload()), extra: true }),
    },
    {
      label: 'Permit signature invalid hex',
      expectStatus: 400,
      expectedDataIncludes: 'Permit signature must be a valid hex string',
      makePayload: async () => ({ ...(await buildBasePayload()), permitSignature: '0x1234' }),
    },
    {
      label: 'Invalid user address',
      expectStatus: 400,
      expectedDataIncludes: 'Invalid address provided',
      makePayload: async () => {
        const payload = await buildBasePayload();
        payload.swap.user = '0x1234';
        return payload;
      },
    },
    {
      label: 'Invalid token address',
      expectStatus: 400,
      expectedDataIncludes: 'Invalid address provided',
      makePayload: async () => {
        const payload = await buildBasePayload();
        payload.swap.tokenIn = 'not-an-address';
        return payload;
      },
    },
    {
      label: 'Unsupported tokenIn',
      expectStatus: 400,
      expectedDataIncludes: 'tokenIn is not supported',
      makePayload: async () => {
        const payload = await buildBasePayload();
        payload.swap.tokenIn = '0x0000000000000000000000000000000000000001';
        return payload;
      },
    },
    {
      label: 'Unsupported tokenOut',
      expectStatus: 400,
      expectedDataIncludes: 'tokenOut is not supported',
      makePayload: async () => {
        const payload = await buildBasePayload();
        payload.swap.tokenOut = '0x0000000000000000000000000000000000000002';
        return payload;
      },
    },
    {
      label: 'Amount not numeric',
      expectStatus: 400,
      expectedDataIncludes: 'must be numeric values',
      makePayload: async () => {
        const payload = await buildBasePayload();
        payload.swap.amountIn = 'abc';
        return payload;
      },
    },
    {
      label: 'Amount not positive',
      expectStatus: 400,
      expectedDataIncludes: 'greater than zero',
      makePayload: async () => {
        const payload = await buildBasePayload();
        payload.swap.amountIn = '0';
        return payload;
      },
    },
    {
      label: 'Expired deadline (permit validation fails)',
      expectStatus: 400,
      expectedDataIncludes: 'Permit deadline has expired',
      makePayload: () => buildBasePayload({ deadlineDeltaSeconds: -60 }),
    },
    {
      label: 'Gas price exceeds limit',
      expectStatus: 400,
      expectedDataIncludes: 'Gas price exceeds maximum limit',
      optional: true,
      makePayload: async () => {
        if (!gasData?.gasPrice || BigInt(gasData.gasPrice) <= MAX_GAS_PRICE) {
          return null;
        }
        return buildBasePayload();
      },
    },
    {
      label: 'Amount exceeds maxUsdtAmount (contract revert)',
      expectStatus: 400,
      expectedDataIncludes: 'amount exceeds limit',
      makePayload: () => buildBasePayload({ amountInOverride: maxUsdtAmount + 1n }),
    },
    {
      label: 'Slippage too strict (contract revert)',
      expectStatus: 400,
      expectedDataIncludes: 'insufficient quote',
      makePayload: () => buildBasePayload({ amountOutMinOverride: expectedOut + 1n }),
    },
    {
      label: 'Malformed signature (internal error)',
      expectStatus: 500,
      expectedDataIncludes: 'Sending transaction was failed after 5 try',
      makePayload: async () => {
        const payload = await buildBasePayload();
        const broken = `0x${'00'.repeat(65)}`;
        return { ...payload, permitSignature: broken };
      },
    },
    {
      label: 'Permit already used (contract revert)',
      expectStatus: 400,
      expectedDataIncludes: 'permit already used',
      makePayload: () => Promise.resolve(deepClone(successfulPayload)),
    },
  ];

  for (const scenario of scenarios) {
    await runScenario(scenario);
  }
}

main().catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});

