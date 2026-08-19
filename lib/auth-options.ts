import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";
import { isGoogleWhitelistEmail, isAllowedHostedDomain } from "../backend/utils/googleWhitelist";

/**
 * Read a claim out of a Google ID token without verifying it.
 *
 * This is only used to gate what the UI renders. The Express API independently
 * verifies the same token (signature, audience, email_verified, hd, whitelist)
 * on every request, so nothing here is a security boundary — but reading `hd`
 * from the token itself keeps this gate consistent with the one the API applies.
 */
function idTokenClaim(idToken: string | undefined, claim: string): unknown {
  if (!idToken) return undefined;
  const payload = idToken.split(".")[1];
  if (!payload) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))[claim];
  } catch {
    return undefined;
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }: { user: any; account: any }) {
      // Google sign-in is restricted to the whitelist...
      const email = (user?.email as string) || "";
      if (!isGoogleWhitelistEmail(email)) {
        throw new Error("Access denied: Email not in whitelist");
      }
      // ...and to the allowed Google Workspace domain(s).
      const hd = idTokenClaim(account?.id_token, "hd") as string | undefined;
      if (!isAllowedHostedDomain(hd)) {
        throw new Error("Access denied: Google Workspace domain not allowed");
      }
      return true;
    },
    async jwt({ token, account }: { token: JWT; account: { id?: string; access_token?: string; id_token?: string; expires_at?: number } | null }) {
      if (account) {
        token.userId = account.id as string;
        token.accessToken = account.access_token;
        // The Google ID token is what the backend API verifies
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;
        (token as any).hd = idTokenClaim(account.id_token, "hd");

        return { ...token, sessionExpired: false };
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Basic identity fields from token
      session.accessToken = token.accessToken as string;
      session.user.id = token.userId as string;
      session.user.email = (session.user.email as string) || (token as any).email;
      session.user.image = (token as any).picture as string;
      session.user.name = (token as any).name as string;

      // Make idToken and its expiry (epoch seconds) available for backend API calls
      session.idToken = (token as any).idToken as string;
      session.idTokenExpires = (token as any).expiresAt as number;

      session.user.provider = "google";

      // Admin requires both the whitelist and the allowed Workspace domain,
      // matching what the API enforces. "viewer" means no access anywhere.
      const isAdmin =
        isGoogleWhitelistEmail(session.user.email || "") &&
        isAllowedHostedDomain((token as any).hd as string | undefined);
      session.user.role = isAdmin ? "super_admin" : "viewer";

      // Compute sessionExpired using idTokenExpires
      const expiresMs = typeof session.idTokenExpires === "number" ? session.idTokenExpires * 1000 : 0;
      session.sessionExpired = expiresMs ? Date.now() >= expiresMs : false;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  // Add these options to improve compatibility
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
  },
  // Custom pages
  pages: {
    signIn: '/auth/login',
    error: '/auth/login', // Redirect errors to login page
  },
  // Add event handling
  events: {
    async signOut() {
      // Clean up any necessary resources
    },
  },
};
