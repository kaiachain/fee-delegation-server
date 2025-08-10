const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verify(idToken) {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error("Invalid token");
    }

    const admins = (process.env.GOOGLE_WHITELIST || "").split(",");

    if (!admins.includes(payload.email)) {
      return { ...payload, role: "viewer" };
    }

    return { ...payload, role: "editor" };
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid token");
  }
}

module.exports = { verify }; 