const { isIP } = require('node:net');

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
]);

const SCHEME_ERROR = 'URL must use http:// or https://';
const BLOCKED_DESTINATION_ERROR =
  'RPC URL must not target private, loopback, link-local, or cloud metadata addresses';
const INVALID_URL_ERROR = 'Invalid RPC URL';

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
  // IPv4-mapped IPv6
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) {
    return isPrivateOrSpecialIpv4(v4Mapped[1]);
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

function isBlockedHost(hostname) {
  const host = normalizeHostname(hostname);
  if (isBlockedHostname(host)) return true;

  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateOrSpecialIpv4(host);
  if (ipVersion === 6) return isPrivateOrSpecialIpv6(host);
  return false;
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

module.exports = {
  getRpcUrlValidationError,
  SCHEME_ERROR,
  BLOCKED_DESTINATION_ERROR,
  INVALID_URL_ERROR,
};
