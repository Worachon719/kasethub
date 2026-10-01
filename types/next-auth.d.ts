import type { DefaultSession } from "next-auth";

/**
 * Session shape exposed to the client. NextAuth's adapter user record is
 * untyped, so the role and verification tier are declared here explicitly.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      verification: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    verification?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    verification?: string;
  }
}
