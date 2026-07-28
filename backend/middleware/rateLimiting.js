// Simple in-memory token bucket per key
const buckets = new Map();

function resolveOption(value, req) {
  return typeof value === 'function' ? value(req) : value;
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

/**
 * Generic rate limiter middleware factory
 * rateLimit({ name: 'login', max: 10, windowMs: 60_000, keyFn, includeIp: true, skipIf })
 */
function rateLimit({
  name = 'general',
  max = 10,
  windowMs = 60_000,
  keyFn,
  includeIp = true,
  skipIf,
} = {}) {
  return (req, res, next) => {
    if (typeof skipIf === 'function' && skipIf(req)) {
      return next();
    }

    const resolvedMax = resolveOption(max, req);
    const resolvedWindowMs = resolveOption(windowMs, req);
    const now = Date.now();

    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.start >= bucket.windowMs) buckets.delete(key);
    }

    const ip = clientIp(req);
    const customKey = typeof keyFn === 'function' ? keyFn(req) : '';
    const key = includeIp ? `${name}:${customKey}:${ip}` : `${name}:${customKey}`;

    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= bucket.windowMs) {
      bucket = { count: 0, start: now, windowMs: resolvedWindowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= resolvedMax) {
      res.setHeader('Retry-After', Math.ceil((bucket.start + bucket.windowMs - now) / 1000));
      return res.status(429).json({ message: 'Too many requests', status: false, error: 'RATE_LIMITED' });
    }

    bucket.count++;
    next();
  };
}

module.exports = { rateLimit, clientIp };
