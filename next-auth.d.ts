import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "editor" | "viewer" | "super_admin";
      provider?: string;
    };
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    idTokenExpires?: number;
    sessionExpired?: boolean;
  }

  interface JWT {
    userId: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    idTokenExpires?: number;
    sessionExpired?: boolean;
  }
}
