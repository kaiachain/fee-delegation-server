const { OAuth2Client } = require("google-auth-library");
const { isGoogleWhitelistEmail, isAllowedHostedDomain } = require("./googleWhitelist");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verify(idToken) {
  // google-auth-library skips audience validation entirely when the audience is
  // undefined, which would accept Google-signed ID tokens minted for any other
  // OAuth client. Fail closed rather than silently dropping the check.
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    console.error("GOOGLE_CLIENT_ID is not configured; refusing to verify ID tokens");
    throw new Error("Invalid token");
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error("Invalid token");
    }

    // An unverified email claim must never satisfy the whitelist
    if (payload.email_verified !== true) {
      return { ...payload, role: "viewer" };
    }

    // Optional Google Workspace hosted-domain restriction (GOOGLE_ALLOWED_HD)
    if (!isAllowedHostedDomain(payload.hd)) {
      return { ...payload, role: "viewer" };
    }

    if (!isGoogleWhitelistEmail(payload.email)) {
      return { ...payload, role: "viewer" };
    }

    return { ...payload, role: "super_admin" };
  } catch (error) {
    // Don't log expected JWT format mismatches (NextAuth vs Google tokens)
    if (!error.message?.includes("No pem found for envelope")) {
      console.error("Token verification failed:", error);
    }
    throw new Error("Invalid token");
  }
}

module.exports = { verify };
