import { ethers } from "hardhat";

async function main() {
  const routerAddress = process.env.UNISWAP_ROUTER ?? "0x41f135a084897e4145cc2032e8701726af795e3a";

  if (!ethers.isAddress(routerAddress)) {
    throw new Error("UNISWAP_ROUTER must be a valid address");
  }

  const Swap = await ethers.getContractFactory("GaslessERC20PermitSwap");
  const swap = await Swap.deploy(routerAddress);
  await swap.waitForDeployment();

  console.log("GaslessERC20PermitSwap deployed to:", await swap.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

