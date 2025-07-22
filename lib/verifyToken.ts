import { OAuth2Client, TokenPayload } from "google-auth-library";

interface DecodedToken extends TokenPayload {
  role: "viewer" | "editor";
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verify(idToken: string): Promise<DecodedToken> {
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

    if (!admins.includes(payload.email as string)) {
      return { ...payload, role: "viewer" };
    }

    return { ...payload, role: "editor" };
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid token");
  }
}
