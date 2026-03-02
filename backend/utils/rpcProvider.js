const { JsonRpcProvider } =  require("@kaiachain/ethers-ext/v6");
const { prisma } = require('./prisma');

// Mutable state: loaded from DB on init and refreshed on add/remove
let rpcUrls = [];
let providerPool = [];

const getOrCreateProvider = (idx) => {
  if (!providerPool[idx]) {
    providerPool[idx] = new JsonRpcProvider(rpcUrls[idx]);
  }
  return providerPool[idx];
};

const EVICT_DELAY_MS = 3000;
const evictProvider = (provider) => {
  if (!provider) return;
  for (let i = 0; i < providerPool.length; i++) {
    if (providerPool[i] === provider) {
      providerPool[i] = null;
      break;
    }
  }
  setTimeout(() => {
    const stillInPool = providerPool.some(p => p === provider);
    if (!stillInPool) {
      try { provider.destroy?.(); } catch {}
    }
  }, EVICT_DELAY_MS);
};

const HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * Load active RPC URLs from the database.
 * Preserves providers for URLs that still exist.
 *
 * Safety for in-flight requests:
 * 1. Pool swap is immediate — new requests never pick the removed provider.
 * 2. Removed providers are destroyed after EVICT_DELAY_MS (3s).
 * 3. If an in-flight request hits "provider destroyed" during the receipt
 *    loop, isRpcRelatedError() catches it and pickDifferentProvider()
 *    switches to another healthy provider seamlessly.
 */
const loadRpcUrls = async () => {
  try {
    const rows = await prisma.rpcUrl.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } });
    const newUrls = rows.map(r => r.url);

    const oldUrls = rpcUrls;
    const oldPool = providerPool;

    // Rebuild pool: preserve existing providers for URLs that still exist
    const newPool = new Array(newUrls.length).fill(null);
    for (let i = 0; i < newUrls.length; i++) {
      const oldIdx = oldUrls.indexOf(newUrls[i]);
      if (oldIdx !== -1 && oldPool[oldIdx]) {
        newPool[i] = oldPool[oldIdx];
      }
    }

    // Swap arrays — new requests use the new pool immediately.
    rpcUrls = newUrls;
    providerPool = newPool;

    // Destroy removed providers after EVICT_DELAY_MS.
    // If an in-flight request is still using it, the "provider destroyed"
    // error is caught by isRpcRelatedError → pickDifferentProvider.
    for (let i = 0; i < oldUrls.length; i++) {
      if (!newUrls.includes(oldUrls[i]) && oldPool[i]) {
        const provider = oldPool[i];
        setTimeout(() => {
          try { provider.destroy?.(); } catch {}
        }, EVICT_DELAY_MS);
      }
    }

    console.log(`RPC provider pool loaded: ${rpcUrls.length} URL(s)`);
  } catch (error) {
    console.error('Failed to load RPC URLs from database:', error.message);
    if (rpcUrls.length === 0) {
      const envUrls = (process.env.RPC_URL || "").split(",").map(u => u.trim()).filter(Boolean);
      if (envUrls.length > 0) {
        console.warn('Falling back to RPC_URL env variable');
        rpcUrls = envUrls;
        providerPool = new Array(envUrls.length).fill(null);
      }
    }
  }
};

// Load on module init
loadRpcUrls();

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
    message.includes('provider destroyed') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  );
};

/**
 * Ping a URL directly with klay_blockNumber (lowest latency RPC call)
 * without creating a persistent JsonRpcProvider instance.
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
 * Pings each URL with a raw fetch before creating a JsonRpcProvider.
 * Returns null if no providers are healthy.
 */
const pickHealthyProvider = async (requestId = null) => {
  const pCount = rpcUrls.length;
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
 * Pick a different healthy provider from the pool, excluding the current one.
 * Pings candidate URLs before returning a provider.
 * When a healthy replacement is found, the old provider is evicted and
 * destroyed after a delay.
 * Returns null if no other healthy provider is available.
 */
const pickDifferentProvider = async (currentProvider, requestId = null) => {
  const pCount = rpcUrls.length;
  if (pCount <= 1) return null;

  const currentUrl = getProviderUrl(currentProvider);
  const candidates = [];
  for (let i = 0; i < pCount; i++) {
    if (rpcUrls[i] !== currentUrl) {
      candidates.push({ idx: i, url: rpcUrls[i] });
    }
  }

  if (candidates.length === 0) return null;

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const candidate of candidates) {
    const healthy = await pingUrl(candidate.url);
    if (healthy) {
      if (requestId) {
        console.log(`Request ID:${requestId} - Switching RPC provider: ${currentUrl} -> ${candidate.url}`);
      }
      evictProvider(currentProvider);
      return getOrCreateProvider(candidate.idx);
    }
    if (requestId) {
      console.warn(`Request ID:${requestId} - Candidate provider health check failed: ${candidate.url}`);
    }
  }

  if (requestId) {
    console.warn(`Request ID:${requestId} - No healthy alternative provider found, staying with current`);
  }
  return null;
};

/**
 * TEST ONLY: Create a provider and track it in the pool for proper eviction.
 */
const injectTestProvider = (url) => {
  const provider = new JsonRpcProvider(url);
  providerPool.push(provider);
  return provider;
};

/**
 * TEST ONLY: Re-insert an existing provider back into the pool.
 */
const reinjectTestProvider = (provider) => {
  const alreadyInPool = providerPool.some(p => p === provider);
  if (!alreadyInPool) {
    providerPool.push(provider);
  }
};

const getRpcHostnames = () => {
  return rpcUrls
    .map(u => { try { return new URL(u).hostname; } catch { return null; } })
    .filter(Boolean);
};

module.exports = {
  loadRpcUrls,
  pickHealthyProvider,
  pickDifferentProvider,
  isRpcRelatedError,
  getProviderUrl,
  getRpcHostnames,
  pingUrl,
  injectTestProvider,
  reinjectTestProvider,
};
