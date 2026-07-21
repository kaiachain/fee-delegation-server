function parseGoogleWhitelist(value) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isGoogleWhitelistEmail(email, whitelistValue = process.env.GOOGLE_WHITELIST) {
  return parseGoogleWhitelist(whitelistValue).includes(email);
}

module.exports = {
  parseGoogleWhitelist,
  isGoogleWhitelistEmail,
};
