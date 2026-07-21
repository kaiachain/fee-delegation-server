const { createResponse } = require('../utils/apiUtils');
const { verifyRecaptchaToken } = require('../utils/recaptcha');

async function validateLoginRecaptcha(req, res, next) {
  try {
    const { recaptchaToken } = req.body || {};
    const result = await verifyRecaptchaToken(recaptchaToken);

    if (!result.ok) {
      return createResponse(res, 'BAD_REQUEST', 'reCAPTCHA verification failed');
    }

    next();
  } catch (error) {
    console.error('reCAPTCHA middleware error:', error);
    return createResponse(res, 'BAD_REQUEST', 'reCAPTCHA verification failed');
  }
}

module.exports = { validateLoginRecaptcha };
