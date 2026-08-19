function parseGoogleWhitelist(value) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isGoogleWhitelistEmail(email, whitelistValue = process.env.GOOGLE_WHITELIST) {
  return parseGoogleWhitelist(whitelistValue).includes(email);
}

// Applied when GOOGLE_ALLOWED_HD is not set, so a missing env var restricts
// sign-in rather than widening it.
const DEFAULT_ALLOWED_HD = ['kaia.io'];

// Explicit opt-out sentinel. A blank value no longer disables the check, so
// allowing non-Workspace (consumer Gmail) accounts has to be deliberate.
const DISABLE_HD_CHECK = '*';

function parseAllowedHostedDomains(value) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Google Workspace hosted-domain (`hd`) enforcement.
 *
 * The `hd` claim is only present on Google Workspace accounts; consumer Gmail
 * accounts never carry it. Enforcement is on by default and defaults to
 * kaia.io, so a token must carry a matching `hd` in addition to appearing in
 * GOOGLE_WHITELIST. A whitelisted consumer Gmail address is therefore denied
 * unless GOOGLE_ALLOWED_HD names its domain or is set to '*'.
 */
function isAllowedHostedDomain(hd, allowedValue = process.env.GOOGLE_ALLOWED_HD) {
  const configured = parseAllowedHostedDomains(allowedValue);

  // Explicit opt-out: accept any account, including consumer Gmail.
  if (configured.includes(DISABLE_HD_CHECK)) {
    return true;
  }

  const allowed = configured.length > 0 ? configured : DEFAULT_ALLOWED_HD;

  // No hd claim at all means a consumer account -> deny.
  if (!hd || typeof hd !== 'string') {
    return false;
  }

  return allowed.includes(hd.trim().toLowerCase());
}

module.exports = {
  DEFAULT_ALLOWED_HD,
  parseGoogleWhitelist,
  isGoogleWhitelistEmail,
  parseAllowedHostedDomains,
  isAllowedHostedDomain,
};
