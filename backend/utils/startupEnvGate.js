const VALID_NETWORKS = new Set(['mainnet', 'testnet']);

const PLACEHOLDER_SECRETS = {
  EMAIL_AUTH_JWT_SECRET: 'change-me-in-env',
  NEXTAUTH_SECRET: 'fallback-secret-for-development',
};

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function validateStartupEnv(env = process.env) {
  const errors = [];

  const network = env.NETWORK;
  if (isMissing(network) || !VALID_NETWORKS.has(network)) {
    errors.push('NETWORK must be exactly "mainnet" or "testnet"');
  }

  if (env.NODE_ENV === 'production') {
    for (const [name, placeholder] of Object.entries(PLACEHOLDER_SECRETS)) {
      const value = env[name];
      if (isMissing(value) || value === placeholder) {
        errors.push(`${name} must be set to a non-placeholder value in production`);
      }
    }
  }

  return errors;
}

function assertStartupEnv(env = process.env) {
  const errors = validateStartupEnv(env);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
}

module.exports = { validateStartupEnv, assertStartupEnv };
