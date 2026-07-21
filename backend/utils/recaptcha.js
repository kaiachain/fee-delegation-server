const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

function isProduction(env = process.env) {
  return env.NODE_ENV === 'production';
}

function isMissingSecret(env = process.env) {
  const secret = env.RECAPTCHA_SECRET_KEY;
  return secret === undefined || secret === null || String(secret).trim() === '';
}

/**
 * Returns whether reCAPTCHA must be verified for the current environment.
 * Production always requires verification; non-production skips when unconfigured.
 */
function isRecaptchaRequired(env = process.env) {
  if (isProduction(env)) {
    return true;
  }
  return !isMissingSecret(env);
}

/**
 * Verify a reCAPTCHA token against Google's siteverify API.
 * Production fails closed when RECAPTCHA_SECRET_KEY is missing.
 * Non-production skips verification when the secret is unset.
 */
async function verifyRecaptchaToken(token, options = {}) {
  const env = options.env || process.env;
  const fetchFn = options.fetchFn || fetch;

  if (!isRecaptchaRequired(env)) {
    return { ok: true, skipped: true };
  }

  if (isMissingSecret(env)) {
    return { ok: false, reason: 'missing_secret' };
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', env.RECAPTCHA_SECRET_KEY);
    params.append('response', token);

    const response = await fetchFn(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      return { ok: false, reason: 'api_error' };
    }

    const data = JSON.parse(await response.text());
    if (data.success) {
      return { ok: true };
    }

    return { ok: false, reason: 'verification_failed' };
  } catch {
    return { ok: false, reason: 'verification_error' };
  }
}

module.exports = {
  isProduction,
  isRecaptchaRequired,
  verifyRecaptchaToken,
};
