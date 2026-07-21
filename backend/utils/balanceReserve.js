const { prisma } = require('./prisma');
const { isEnoughBalance } = require('./apiUtils');

const MAX_RESERVE_RETRIES = 5;

function estimateTxFeeWei(tx) {
  const gasLimit = typeof tx.gasLimit === 'bigint' ? tx.gasLimit : BigInt(tx.gasLimit || '0');
  const gasPrice = typeof tx.gasPrice === 'bigint' ? tx.gasPrice : BigInt(tx.gasPrice || '0');
  return gasLimit * gasPrice;
}

async function reserveDappBalance(dappId, estimateWei) {
  const estimate = typeof estimateWei === 'bigint' ? estimateWei : BigInt(estimateWei);

  for (let attempt = 0; attempt < MAX_RESERVE_RETRIES; attempt++) {
    const snapshot = await prisma.dApp.findUnique({
      where: { id: dappId },
      select: { balance: true },
    });

    if (!snapshot) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    const currentBalance = BigInt(snapshot.balance);
    const nextBalance = currentBalance - estimate;

    if (nextBalance < 0n || !isEnoughBalance(nextBalance)) {
      return { ok: false, reason: 'INSUFFICIENT' };
    }

    const updated = await prisma.dApp.updateMany({
      where: { id: dappId, balance: snapshot.balance },
      data: { balance: nextBalance.toString() },
    });

    if (updated.count === 1) {
      return {
        ok: true,
        reservedWei: estimate,
        balanceAfterReserve: nextBalance.toString(),
      };
    }
  }

  return { ok: false, reason: 'CONFLICT' };
}

async function releaseDappBalance(dappId, reservedWei) {
  const amount = typeof reservedWei === 'bigint' ? reservedWei : BigInt(reservedWei);

  await prisma.$transaction(async (tx) => {
    const dapp = await tx.dApp.findUnique({
      where: { id: dappId },
      select: { balance: true },
    });

    if (!dapp) {
      return;
    }

    const restoredBalance = (BigInt(dapp.balance) + amount).toString();
    await tx.dApp.update({
      where: { id: dappId },
      data: { balance: restoredBalance },
    });
  });
}

module.exports = {
  estimateTxFeeWei,
  reserveDappBalance,
  releaseDappBalance,
};
