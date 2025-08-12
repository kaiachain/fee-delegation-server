import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";
import jwt from "jsonwebtoken";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
          const res = await fetch(`${API_URL}/email-auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: credentials?.email, password: credentials?.password }),
          });
          const data = await res.json();
          if (!res.ok || !data?.status) {
            return null;
          }
          const token = data?.data?.token as string;
          const role = (data?.data?.role as string) || "viewer";
          const decoded: any = jwt.decode(token) || {};
          const exp = typeof decoded?.exp === "number" ? decoded.exp : undefined;
          return {
            id: data?.data?.email || credentials?.email || "",
            email: data?.data?.email || credentials?.email || "",
            role,
            emailJwt: token,
            emailTokenExpiresAt: exp,
            provider: "credentials",
          } as any;
        } catch {
          return null;
        }
      },
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
    async session({ session, token, user }: { session: Session; token: JWT; user: any }) {
      session.accessToken = token.accessToken as string;
      session.user.id = token.userId as string;
      session.user.email = token.email as string;
      session.user.image = token.picture as string;
      session.user.name = token.name as string;
      // Ensure idToken is available for backend API calls
      session.idToken = token.idToken as string;
      session.idTokenExpires = token.expiresAt as number;
      // If credentials provider was used, carry over role and JWT
      // NextAuth places credentials 'user' only on initial sign in; afterwards, store into token on jwt callback
      // Here, we trust user object when present to seed the session
      if ((user as any)?.provider === "credentials") {
        const u = user as any;
        session.user.role = (u.role as "editor" | "viewer" | "super_admin") || "viewer";
        if (u.emailJwt) {
          session.idToken = u.emailJwt as string;
          if (u.emailTokenExpiresAt) session.idTokenExpires = u.emailTokenExpiresAt as number;
        }
      } else {
        // Fallback: Google whitelist -> super_admin, else viewer
        const admins = (process.env.GOOGLE_WHITELIST || "").split(",");
        if (admins.includes(session.user.email)) {
          session.user.role = "super_admin";
        } else {
          session.user.role = "viewer";
        }
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