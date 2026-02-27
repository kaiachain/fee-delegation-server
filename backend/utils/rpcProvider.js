const { JsonRpcProvider } =  require("@kaiachain/ethers-ext/v6");

const rpcUrls = (process.env.RPC_URL || "").split(",").map(u => u.trim()).filter(Boolean);
const pCount = rpcUrls.length;

// Lazy-initialized provider pool. Providers are created on first use via
// pickHealthyProvider (which pings the URL first), so broken URLs never
// get a JsonRpcProvider instance unless they were healthy at some point.
const providerPool = new Array(pCount).fill(null);

const getOrCreateProvider = (idx) => {
  if (!providerPool[idx]) {
    providerPool[idx] = new JsonRpcProvider(rpcUrls[idx]);
  }
  return providerPool[idx];
};

/**
 * Remove a provider from the cache and schedule its destruction.
 * The delayed destroy() gives in-flight operations time to finish,
 * then stops the provider's background network-detection retry loop.
 * If the provider is re-injected into the pool before the timer fires,
 * the destroy is skipped.
 */
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
 * Pick a different healthy provider from the pool, excluding the current one.
 * Pings candidate URLs before returning a provider to avoid creating
 * JsonRpcProvider instances for broken URLs.
 * When a healthy replacement is found, the old provider is evicted from cache
 * and destroyed after a delay (to stop its background retry loop without
 * cancelling any in-flight requests).
 * Returns null if no other healthy provider is available.
 */
const pickDifferentProvider = async (currentProvider, requestId = null) => {
  if (pCount <= 1) return null;

  const currentUrl = getProviderUrl(currentProvider);
  const candidates = [];
  for (let i = 0; i < pCount; i++) {
    if (rpcUrls[i] !== currentUrl) {
      candidates.push({ idx: i, url: rpcUrls[i] });
    }
  }

  if (candidates.length === 0) return null;

  // Shuffle candidates so we don't always try the same order
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
 * Call once to create the broken provider, then use reinjectTestProvider()
 * to put it back into the pool for subsequent retry iterations.
 *
 * Usage:
 *   const brokenProvider = injectTestProvider("https://fake-broken-rpc.invalid");
 *   // later, to simulate failure again after a switch:
 *   reinjectTestProvider(brokenProvider);
 */
const injectTestProvider = (url) => {
  const provider = new JsonRpcProvider(url);
  providerPool.push(provider);
  return provider;
};

/**
 * TEST ONLY: Re-insert an existing provider back into the pool.
 * Reuses the same instance (no new retry loop created).
 */
const reinjectTestProvider = (provider) => {
  const alreadyInPool = providerPool.some(p => p === provider);
  if (!alreadyInPool) {
    providerPool.push(provider);
  }
};

module.exports = {
  pickProviderFromPool,
  pickHealthyProvider,
  pickDifferentProvider,
  isRpcRelatedError,
  getProviderUrl,
  injectTestProvider,
  reinjectTestProvider,
};