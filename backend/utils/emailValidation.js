const MAX_EMAIL_LENGTH = 254;

// Anchored character-class pattern; no nested quantifiers (ReDoS-safe after length check).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  return EMAIL_PATTERN.test(email);
}

module.exports = {
  MAX_EMAIL_LENGTH,
  isValidEmail,
};
