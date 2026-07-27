const { isIP } = require('node:net');
const dns = require('node:dns').promises;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
]);

const SCHEME_ERROR = 'URL must use http:// or https://';
const BLOCKED_DESTINATION_ERROR =
  'RPC URL must not target private, loopback, link-local, or cloud metadata addresses';
const INVALID_URL_ERROR = 'Invalid RPC URL';
const DNS_RESOLUTION_ERROR = 'RPC URL hostname could not be resolved';

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateOrSpecialIpv4(ip) {
  const n = ipv4ToInt(ip);
  const masked24 = (n & 0xff000000) >>> 0;
  const masked16 = (n & 0xffff0000) >>> 0;
  const masked12 = (n & 0xfff00000) >>> 0;
  if (masked24 === 0x00000000) return true;
  if (masked24 === 0x0a000000) return true;
  if (masked24 === 0x7f000000) return true;
  if (masked16 === 0xa9fe0000) return true;
  if (masked12 === 0xac100000) return true;
  if (masked16 === 0xc0a80000) return true;
  return false;
}

function isPrivateOrSpecialIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized === '::') return true;
  // fe80::/10 link-local
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }
  // fc00::/7 unique local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  // IPv4-mapped IPv6 — dotted form (::ffff:127.0.0.1) or hex (::ffff:7f00:1)
  const v4MappedDotted = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4MappedDotted) {
    return isPrivateOrSpecialIpv4(v4MappedDotted[1]);
  }
  const v4MappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4MappedHex) {
    const hi = parseInt(v4MappedHex[1], 16);
    const lo = parseInt(v4MappedHex[2], 16);
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateOrSpecialIpv4(dotted);
  }
  return false;
}

function isBlockedHostname(hostname) {
  const host = hostname.replace(/\.$/, '').toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  if (host.endsWith('.internal')) return true;
  return false;
}

function normalizeHostname(hostname) {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function isBlockedIpAddress(address) {
  const host = normalizeHostname(address);
  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateOrSpecialIpv4(host);
  if (ipVersion === 6) return isPrivateOrSpecialIpv6(host);
  return false;
}

function isBlockedHost(hostname) {
  const host = normalizeHostname(hostname);
  if (isBlockedHostname(host)) return true;
  return isBlockedIpAddress(host);
}

function getRpcUrlValidationError(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return INVALID_URL_ERROR;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return INVALID_URL_ERROR;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return INVALID_URL_ERROR;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return SCHEME_ERROR;
  }

  if (parsed.username || parsed.password) {
    return INVALID_URL_ERROR;
  }

  if (isBlockedHost(parsed.hostname)) {
    return BLOCKED_DESTINATION_ERROR;
  }

  return null;
}

async function defaultLookup(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

/**
 * Sync URL shape checks plus DNS resolution of the hostname.
 * Rejects if any resolved address is private/loopback/link-local/metadata.
 */
async function assertRpcUrlSafeForOutbound(rawUrl, options = {}) {
  const syncError = getRpcUrlValidationError(rawUrl);
  if (syncError) {
    return syncError;
  }

  const parsed = new URL(String(rawUrl).trim());
  const hostname = normalizeHostname(parsed.hostname);

  // Literal IPs are already covered by the sync check.
  if (isIP(hostname)) {
    return null;
  }

  const lookup = options.lookup || defaultLookup;
  let addresses;
  try {
    addresses = await lookup(hostname);
  } catch {
    return DNS_RESOLUTION_ERROR;
  }

  const list = Array.isArray(addresses) ? addresses : [addresses];
  if (list.length === 0) {
    return DNS_RESOLUTION_ERROR;
  }

  for (const entry of list) {
    const address = typeof entry === 'string' ? entry : entry.address;
    if (!address || isBlockedIpAddress(address) || isBlockedHostname(address)) {
      return BLOCKED_DESTINATION_ERROR;
    }
  }

  return null;
}

async function filterSafeRpcUrls(urls, options = {}) {
  const safe = [];
  for (const url of urls) {
    const err = await assertRpcUrlSafeForOutbound(url, options);
    if (err) {
      let host = 'invalid';
      try {
        host = new URL(String(url).trim()).hostname;
      } catch {
        // ignore parse errors for logging
      }
      console.warn(`Skipping unsafe RPC URL (${host}): ${err}`);
      continue;
    }
    safe.push(url);
  }
  return safe;
}

module.exports = {
  getRpcUrlValidationError,
  assertRpcUrlSafeForOutbound,
  filterSafeRpcUrls,
  isBlockedIpAddress,
  SCHEME_ERROR,
  BLOCKED_DESTINATION_ERROR,
  INVALID_URL_ERROR,
  DNS_RESOLUTION_ERROR,
};
