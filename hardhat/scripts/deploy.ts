import { ethers } from "hardhat";

async function main() {
  const privateKey = process.env.PRIVATE_KEY ?? "your_private_key";
  const rpcUrl = process.env.RPC_URL ?? "https://public-en-kairos.node.kaia.io";
  const wallet = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpcUrl));

  const routerAddress = process.env.UNISWAP_ROUTER ?? "0x41f135a084897e4145cc2032e8701726af795e3a";
  const usdtAddress = process.env.USDT_ADDRESS ?? "0xcb00ba2cab67a3771f9ca1fa48fda8881b457750";
  const wkaiaAddress = process.env.WKAIA_ADDRESS ?? "0x043c471bEe060e00A56CcD02c0Ca286808a5A436";
  const ownerAddress = process.env.OWNER_ADDRESS ?? wallet.address;

  if (![routerAddress, usdtAddress, wkaiaAddress, ownerAddress].every(ethers.isAddress)) {
    throw new Error("UNISWAP_ROUTER, USDT_ADDRESS, WKAIA_ADDRESS, and OWNER_ADDRESS must be valid addresses");
  }

  const Swap = await ethers.getContractFactory("GaslessERC20PermitSwap", wallet);
  const swap = await Swap.deploy(ownerAddress, routerAddress, usdtAddress, wkaiaAddress);
  await swap.waitForDeployment();

  console.log("GaslessERC20PermitSwap deployed to:", await swap.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


