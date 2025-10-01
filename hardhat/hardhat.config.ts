import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const KAIA_RPC_URL = process.env.KAIA_RPC_URL || "https://public-en-kairos.node.kaia.io";
const KAIA_PRIVATE_KEY = process.env.KAIA_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "contracts",
    tests: "test",
    cache: "cache",
    artifacts: "artifacts",
  },
  networks: {
    hardhat: {},
    kaiaTestnet: {
      url: KAIA_RPC_URL,
      accounts: KAIA_PRIVATE_KEY ? [KAIA_PRIVATE_KEY] : [],
      chainId: 1001,
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;

