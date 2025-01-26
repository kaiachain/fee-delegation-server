import { JsonRpcProvider } from "@kaiachain/ethers-ext/v6";

const providers = (process.env.RPC_URL || "")
  .split(",")
  .filter((url) => !url.includes("http://freely-inspired-ram.n0des.xyz"));
const providerPool = providers.map((url) => new JsonRpcProvider(url));
const pCount = providers.length;

const pickProviderFromPool = () => {
  if (pCount === 0) throw Error("No available provider");

  const random = Math.floor(Math.random() * pCount);
  console.log(providers[random]);
  return providerPool[random];
};

export default pickProviderFromPool;
