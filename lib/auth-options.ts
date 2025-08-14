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
    async signIn({ user, account }: { user: any; account: any }) {
      // Additional restriction for Google sign-in to whitelist only
      if (account?.provider === "google") {
        const admins = (process.env.GOOGLE_WHITELIST || "").split(",");
        const email = (user?.email as string) || "";
        if (!admins.includes(email)) {
          // Block unauthorized Google sign-ins
          throw new Error("Access denied: Email not in whitelist");
        }
        return true;
      }
      // Allow credentials (email/password) sign-in
      return true;
    },
    async jwt({ token, account, user }: { token: JWT; account: { id?: string; access_token?: string; id_token?: string; expires_at?: number, provider?: string; emailJwt?: string; emailTokenExpiresAt?: number; user?: any } | null, user?: any }) {
      if (account) {
        token.userId = account.id as string;
        token.accessToken = account.access_token;
        token.idToken = account.provider === "credentials" ? user.emailJwt : account.id_token;
        token.expiresAt = account.provider === "credentials" ? user.emailTokenExpiresAt : account.expires_at;
        token.role = account.provider === "credentials" ? user?.role : undefined;
        token.provider = account.provider;

        return { ...token,  sessionExpired: false };
      }
      // Persist credentials provider data into the token on sign-in
      if ((user as any)?.provider === "credentials") {
        const u = user as any;
        // @ts-ignore
        (token as any).role = (u.role as string) || "viewer";
        if (u.emailJwt) {
          token.idToken = u.emailJwt as string;
        }
        if (u.emailTokenExpiresAt) {
          token.expiresAt = u.emailTokenExpiresAt as number;
        }
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

      // Role resolution
      const tokenRole = (token as any).role as string | undefined;
      if (tokenRole) {
        session.user.role = tokenRole as "editor" | "viewer" | "super_admin";
      } else {
        // Fallback: Google whitelist -> super_admin, else viewer
        const admins = (process.env.GOOGLE_WHITELIST || "").split(",");
        session.user.role = admins.includes(session.user.email || "") ? "super_admin" : "viewer";
      }

      // Compute sessionExpired using idTokenExpires
      const expiresMs = typeof session.idTokenExpires === "number" ? session.idTokenExpires * 1000 : 0;
      session.sessionExpired = expiresMs ? Date.now() >= expiresMs : false;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  debug: process.env.NODE_ENV === 'development',
  // Add these options to improve compatibility
  session: {
    strategy: "jwt" as const,
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