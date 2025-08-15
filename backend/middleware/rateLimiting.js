// Simple in-memory token bucket per key
const buckets = new Map();

/**
 * Generic rate limiter middleware factory
 * rateLimit({ name: 'login', max: 10, windowMs: 60_000, keyFn })
 */
function rateLimit({ name = 'general', max = 10, windowMs = 60_000, keyFn } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    // prune expired buckets
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.start >= windowMs) buckets.delete(key);
    }
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const customKey = typeof keyFn === 'function' ? keyFn(req) : '';
    const key = `${name}:${customKey}:${ip}`;
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { count: 0, start: now };
      buckets.set(key, bucket);
    }
    if (bucket.count >= max) {
      res.setHeader('Retry-After', Math.ceil((bucket.start + windowMs - now) / 1000));
      return res.status(429).json({ message: 'Too many requests', status: false, error: 'RATE_LIMITED' });
    }
    bucket.count++;
    next();
  };
}

module.exports = { rateLimit };


