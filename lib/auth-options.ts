import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }: { token: JWT; account: { id?: string; access_token?: string; id_token?: string; expires_at?: number } | null }) {
      if (account) {
        token.userId = account.id as string;
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;

        return { ...token, sessionExpired: false };
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.accessToken = token.accessToken as string;
      session.user.id = token.userId as string;
      session.user.email = token.email as string;
      session.user.image = token.picture as string;
      session.user.name = token.name as string;
      // Ensure idToken is available for backend API calls
      session.idToken = token.idToken as string;
      session.idTokenExpires = token.expiresAt as number;
      const admins = (process.env.GOOGLE_WHITELIST || "").split(",");
      if (admins.includes(session.user.email)) {
        session.user.role = "super_admin";
      } else {
        session.user.role = "viewer";
      }
      if (Date.now() < ((session.idTokenExpires as number) * 1000 || 0)) {
        return {
          ...session,
          sessionExpired: false,
        };
      }

      session.sessionExpired = true;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  debug: process.env.NODE_ENV === 'development',
  // Add these options to improve compatibility
  session: {
    strategy: "jwt" as const,
  },
  // Add error handling
  events: {
    async signOut() {
      // Clean up any necessary resources
    },
  },
}; 