const { rateLimit, clientIp } = require('./rateLimiting');

const DEFAULT_IP_MAX = 30;
const DEFAULT_API_KEY_MAX = 60;
const DEFAULT_WINDOW_MS = 60_000;

function readLimit(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function feeDelegationLimits() {
  return {
    maxIp: readLimit('FEE_DELEGATION_RATE_LIMIT_IP_MAX', DEFAULT_IP_MAX),
    maxApiKey: readLimit('FEE_DELEGATION_RATE_LIMIT_API_KEY_MAX', DEFAULT_API_KEY_MAX),
    windowMs: readLimit('FEE_DELEGATION_RATE_LIMIT_WINDOW_MS', DEFAULT_WINDOW_MS),
  };
}

function extractBearerApiKey(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  return typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;
}

/**
 * In-process rate limit for public fee-delegation writes: per IP and per API key when present.
 */
function publicWriteRateLimit(name) {
  const ipLimiter = rateLimit({
    name: `${name}-ip`,
    max: () => feeDelegationLimits().maxIp,
    windowMs: () => feeDelegationLimits().windowMs,
    keyFn: () => '',
  });

  const apiKeyLimiter = rateLimit({
    name: `${name}-apikey`,
    max: () => feeDelegationLimits().maxApiKey,
    windowMs: () => feeDelegationLimits().windowMs,
    includeIp: false,
    keyFn: extractBearerApiKey,
    skipIf: (req) => !extractBearerApiKey(req),
  });

  return (req, res, next) => {
    ipLimiter(req, res, (err) => {
      if (err) return next(err);
      if (res.headersSent) return;
      apiKeyLimiter(req, res, next);
    });
  };
}

module.exports = { publicWriteRateLimit, extractBearerApiKey, feeDelegationLimits, clientIp };
