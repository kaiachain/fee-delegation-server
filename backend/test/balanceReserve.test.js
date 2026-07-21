const { parseKaia } = require('@kaiachain/ethers-ext/v6');
const { prisma } = require('../utils/prisma');
const { createTestAgent } = require('./helpers/app');
const { withEnv } = require('./helpers/env');
const {
  reserveDappBalance,
  releaseDappBalance,
  estimateTxFeeWei,
} = require('../utils/balanceReserve');

jest.mock('@kaiachain/ethers-ext/v6', () => {
  const actual = jest.requireActual('@kaiachain/ethers-ext/v6');
  return {
    ...actual,
    parseTransaction: jest.fn(),
    Wallet: jest.fn().mockImplementation(() => ({
      signTransactionAsFeePayer: jest.fn().mockResolvedValue('0xsigned'),
    })),
  };
});

jest.mock('../utils/rpcProvider', () => ({
  pickHealthyProvider: jest.fn(),
  pickDifferentProvider: jest.fn(),
  isRpcRelatedError: jest.fn(() => false),
  getRpcHostnames: jest.fn(() => []),
}));

const { parseTransaction } = require('@kaiachain/ethers-ext/v6');
const { pickHealthyProvider } = require('../utils/rpcProvider');

const MIN_BALANCE = parseKaia('0.1');
const ESTIMATE_WEI = 100000n * 50000000000n; // 100k gas @ 50 gwei max

const MOCK_TX = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  gasLimit: 100000n,
  gasPrice: 50000000000n,
};

async function seedMainnetDapp(balanceWei) {
  const contractAddress = MOCK_TX.to;
  const senderAddress = MOCK_TX.from;
  const apiKey = 'balance-reserve-test-key';

  const dapp = await prisma.dApp.create({
    data: {
      name: `reserve-test-${Date.now()}-${Math.random()}`,
      url: 'https://example.test',
      balance: balanceWei.toString(),
      active: true,
      contracts: {
        create: [{ address: contractAddress, active: true }],
      },
      senders: {
        create: [{ address: senderAddress, active: true }],
      },
      apiKeys: {
        create: [{ key: apiKey, name: 'test', active: true }],
      },
    },
  });

  return { dapp, apiKey };
}

function mockSuccessfulSignFlow(receiptOverrides = {}) {
  let sendCount = 0;
  const txHash = '0xabc123';
  const receipt = {
    status: 1,
    gasUsed: 21000n,
    gasPrice: 25000000000n,
    to: MOCK_TX.to,
    from: MOCK_TX.from,
    blockNumber: 123n,
    hash: txHash,
    ...receiptOverrides,
  };

  const provider = {
    send: jest.fn().mockImplementation(async () => {
      sendCount += 1;
      return `0xabc${sendCount.toString(16).padStart(3, '0')}`;
    }),
    getTransactionReceipt: jest.fn().mockImplementation(async (hash) => ({
      ...receipt,
      hash,
    })),
  };

  pickHealthyProvider.mockResolvedValue(provider);
  parseTransaction.mockReturnValue({ ...MOCK_TX });

  return { provider, txHash, receipt };
}

describe('balanceReserve utility', () => {
  beforeEach(async () => {
    await prisma.transactionLog.deleteMany();
    await prisma.contractUsage.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.sender.deleteMany();
    await prisma.dApp.deleteMany();
  });

  it('estimateTxFeeWei uses gasLimit * gasPrice', () => {
    expect(estimateTxFeeWei(MOCK_TX)).toBe(ESTIMATE_WEI);
  });

  it('reserveDappBalance atomically deducts estimate when balance allows', async () => {
    const startBalance = MIN_BALANCE + ESTIMATE_WEI * 2n;
    const { dapp } = await seedMainnetDapp(startBalance);

    const result = await reserveDappBalance(dapp.id, ESTIMATE_WEI);
    expect(result.ok).toBe(true);

    const updated = await prisma.dApp.findUnique({ where: { id: dapp.id } });
    expect(BigInt(updated.balance)).toBe(startBalance - ESTIMATE_WEI);
  });

  it('reserveDappBalance rejects when remaining balance would fall below threshold', async () => {
    const startBalance = MIN_BALANCE + ESTIMATE_WEI - 1n;
    const { dapp } = await seedMainnetDapp(startBalance);

    const result = await reserveDappBalance(dapp.id, ESTIMATE_WEI);
    expect(result.ok).toBe(false);

    const unchanged = await prisma.dApp.findUnique({ where: { id: dapp.id } });
    expect(unchanged.balance).toBe(startBalance.toString());
  });

  it('parallel reserves cannot overdraw a dapp balance', async () => {
    const spendable = ESTIMATE_WEI * 3n;
    const startBalance = MIN_BALANCE + spendable + ESTIMATE_WEI;
    const { dapp } = await seedMainnetDapp(startBalance);

    const attempts = 12;
    const results = await Promise.all(
      Array.from({ length: attempts }, () => reserveDappBalance(dapp.id, ESTIMATE_WEI))
    );

    const successes = results.filter((r) => r.ok);
    expect(successes).toHaveLength(3);

    const finalDapp = await prisma.dApp.findUnique({ where: { id: dapp.id } });
    expect(BigInt(finalDapp.balance)).toBe(MIN_BALANCE + ESTIMATE_WEI);
  });

  it('releaseDappBalance restores reserved amount', async () => {
    const startBalance = MIN_BALANCE + ESTIMATE_WEI * 2n;
    const { dapp } = await seedMainnetDapp(startBalance);

    const reserved = await reserveDappBalance(dapp.id, ESTIMATE_WEI);
    expect(reserved.ok).toBe(true);

    await releaseDappBalance(dapp.id, ESTIMATE_WEI);

    const restored = await prisma.dApp.findUnique({ where: { id: dapp.id } });
    expect(restored.balance).toBe(startBalance.toString());
  });
});

describe('POST /api/signAsFeePayer balance reserve (mainnet)', () => {
  const mainnetEnv = {
    NETWORK: 'mainnet',
    ACCOUNT_ADDRESS: '0x9999999999999999999999999999999999999999',
    FEE_PAYER_PRIVATE_KEY: '0x' + '11'.repeat(32),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.transactionLog.deleteMany();
    await prisma.contractUsage.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.sender.deleteMany();
    await prisma.dApp.deleteMany();
  });

  it('does not reserve balance on testnet', async () => {
    const startBalance = parseKaia('1');
    const { dapp, apiKey } = await seedMainnetDapp(startBalance);

    mockSuccessfulSignFlow();

    const agent = createTestAgent();
    const res = await agent
      .post('/api/signAsFeePayer')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ userSignedTx: { raw: '0xdeadbeef' } });

    expect(res.status).toBe(200);

    const after = await prisma.dApp.findUnique({ where: { id: dapp.id } });
    expect(after.balance).toBe(startBalance.toString());
    expect(await prisma.transactionLog.count()).toBe(0);
  });

  it('rejects concurrent mainnet requests once spendable balance is exhausted', async () => {
    const spendable = ESTIMATE_WEI * 2n;
    const startBalance = MIN_BALANCE + spendable + ESTIMATE_WEI;
    const { dapp, apiKey } = await seedMainnetDapp(startBalance);

    mockSuccessfulSignFlow();

    await withEnv(mainnetEnv, async () => {
      const agent = createTestAgent();
      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          agent
            .post('/api/signAsFeePayer')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ userSignedTx: { raw: '0xdeadbeef' } })
        )
      );

      const ok = responses.filter((r) => r.status === 200);
      const rejected = responses.filter(
        (r) => r.status === 400 && String(r.body.data).includes('Insufficient balance')
      );

      expect(ok).toHaveLength(2);
      expect(rejected.length).toBeGreaterThanOrEqual(4);

      const finalDapp = await prisma.dApp.findUnique({ where: { id: dapp.id } });
      expect(BigInt(finalDapp.balance)).toBeGreaterThanOrEqual(MIN_BALANCE);
    });
  });

  it('finalizes reservation into settlement on successful mainnet tx', async () => {
    const startBalance = MIN_BALANCE + ESTIMATE_WEI * 2n;
    const { dapp, apiKey } = await seedMainnetDapp(startBalance);

    const usedFee = 21000n * 25000000000n;
    mockSuccessfulSignFlow();

    await withEnv(mainnetEnv, async () => {
      const agent = createTestAgent();
      const res = await agent
        .post('/api/signAsFeePayer')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ userSignedTx: { raw: '0xdeadbeef' } });

      expect(res.status).toBe(200);
      expect(res.body.data.settlementSuccess).toBe(true);
    });

    const after = await prisma.dApp.findUnique({ where: { id: dapp.id } });
    expect(BigInt(after.balance)).toBe(startBalance - usedFee);
    expect(await prisma.transactionLog.count()).toBe(1);
  });

  it('releases reservation when broadcast fails', async () => {
    const startBalance = MIN_BALANCE + ESTIMATE_WEI * 2n;
    const { dapp, apiKey } = await seedMainnetDapp(startBalance);

    parseTransaction.mockReturnValue({ ...MOCK_TX });
    pickHealthyProvider.mockResolvedValue({
      send: jest.fn().mockRejectedValue(new Error('network busy')),
      getTransactionReceipt: jest.fn(),
    });

    await withEnv(mainnetEnv, async () => {
      const agent = createTestAgent();
      const res = await agent
        .post('/api/signAsFeePayer')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ userSignedTx: { raw: '0xdeadbeef' } });

      expect(res.status).toBe(500);
    });

    const after = await prisma.dApp.findUnique({ where: { id: dapp.id } });
    expect(after.balance).toBe(startBalance.toString());
  });
});
