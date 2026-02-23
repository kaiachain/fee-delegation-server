const { JsonRpcProvider } =  require("@kaiachain/ethers-ext/v6");

const rpcUrls = (process.env.RPC_URL || "").split(",").map(u => u.trim()).filter(Boolean);
const pCount = rpcUrls.length;

// Cached provider pool. Providers are created on first successful use and
// evicted when they hit RPC errors, so ethers' background network-detection
// retry loop never persists for broken URLs.
const providerPool = new Array(pCount).fill(null);

const getOrCreateProvider = (idx) => {
  if (!providerPool[idx]) {
    providerPool[idx] = new JsonRpcProvider(rpcUrls[idx]);
  }
  return providerPool[idx];
};

const evictProvider = (provider) => {
  for (let i = 0; i < pCount; i++) {
    if (providerPool[i] === provider) {
      providerPool[i] = null;
      try { provider.destroy?.(); } catch {}
      return;
    }
  }
};

const HEALTH_CHECK_TIMEOUT_MS = 3000;

const pickProviderFromPool = () => {
  if (pCount === 0) throw Error("No available provider");

  const random = Math.floor(Math.random() * pCount);
  console.log(rpcUrls[random]);
  return getOrCreateProvider(random);
};

const getProviderUrl = (provider) => {
  try {
    const url = provider?._getConnection?.()?.url
      || provider?.provider?._getConnection?.()?.url
      || 'unknown';
    return url;
  } catch {
    return 'unknown';
  }
};

const isRpcRelatedError = (error) => {
  if (!error) return false;
  const code = error.code || error?.error?.code || '';
  const message = (error.message || error?.error?.message || '').toLowerCase();
  return (
    code === 'TIMEOUT' ||
    code === 'SERVER_ERROR' ||
    code === 'NETWORK_ERROR' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  );
};

/**
 * Ping a URL directly with klay_blockNumber (lowest latency RPC call)
 * without creating a persistent JsonRpcProvider instance.
 * Returns true if the URL responds within the timeout.
 */
const pingUrl = async (url) => {
  try {
    const result = await Promise.race([
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'klay_blockNumber', params: [], id: 1 }),
      }).then(r => r.json()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('health check timeout')), HEALTH_CHECK_TIMEOUT_MS)
      ),
    ]);
    return !!result?.result;
  } catch {
    return false;
  }
};

/**
 * Pick a healthy provider from the pool.
 * Pings each URL with a raw fetch (no JsonRpcProvider instantiation) to avoid
 * triggering ethers' background network-detection retry loop on broken URLs.
 * Only creates a JsonRpcProvider for the URL that passes the health check.
 * Returns null if no providers are healthy.
 */
const pickHealthyProvider = async (requestId = null) => {
  if (pCount === 0) throw Error("No available provider");

  const startIdx = Math.floor(Math.random() * pCount);

  for (let i = 0; i < pCount; i++) {
    const idx = (startIdx + i) % pCount;
    const url = rpcUrls[idx];

    const healthy = await pingUrl(url);
    if (healthy) {
      return getOrCreateProvider(idx);
    }

    if (requestId) {
      console.warn(`Request ID:${requestId} - Provider health check failed: ${url}, trying next...`);
    }
  }

  if (requestId) {
    console.error(`Request ID:${requestId} - All providers failed health check`);
  }
  return null;
};

/**
 * Pick a different provider from the pool, excluding the current one.
 * Evicts the current (broken) provider from cache to stop ethers' background retry.
 * Returns null if there's only one provider available.
 */
const pickDifferentProvider = (currentProvider, requestId = null) => {
  evictProvider(currentProvider);

  if (pCount <= 1) return null;

  const currentUrl = getProviderUrl(currentProvider);
  const candidates = [];
  for (let i = 0; i < pCount; i++) {
    if (rpcUrls[i] !== currentUrl) {
      candidates.push({ idx: i, url: rpcUrls[i] });
    }
  }

  if (candidates.length === 0) return null;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  if (requestId) {
    console.log(`Request ID:${requestId} - Switching RPC provider: ${currentUrl} -> ${picked.url}`);
  }
  return getOrCreateProvider(picked.idx);
};

module.exports = {
  pickProviderFromPool,
  pickHealthyProvider,
  pickDifferentProvider,
  isRpcRelatedError,
  getProviderUrl,
};