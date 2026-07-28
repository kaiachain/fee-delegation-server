/**
 * Run fn with temporary process.env overrides, restoring previous values afterward.
 * Use for per-test NETWORK, JWT secrets, reCAPTCHA config, etc.
 */
async function withEnv(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(overrides[key]);
    }
  }

  try {
    return await fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

module.exports = { withEnv };
