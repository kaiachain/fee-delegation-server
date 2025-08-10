const { JsonRpcProvider } =  require("@kaiachain/ethers-ext/v6");

const providers = (process.env.RPC_URL || "").split(",");
const providerPool = providers.map((url) => new JsonRpcProvider(url));
const pCount = providers.length;

const pickProviderFromPool = () => {
  if (pCount === 0) throw Error("No available provider");

  const random = Math.floor(Math.random() * pCount);
  console.log(providers[random]);
  return providerPool[random];
};

module.exports = {
  pickProviderFromPool
};