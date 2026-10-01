import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** Bcrypt cost. 12 is a reasonable floor for 2026 hardware. */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthOptions = {
  // JWT, not database sessions. NextAuth v4 throws
  // CALLBACK_CREDENTIALS_JWT_ERROR for a credentials provider on a database
  // strategy, so this is the only combination that supports password sign-in.
  // The trade-off is that signing out clears the cookie rather than deleting a
  // session row, so a session cannot be revoked server-side before it expires.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        // Users created before passwords existed (seed data) cannot sign in.
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.nameTh ?? user.nameEn ?? user.email,
          role: user.role,
          verification: user.verification,
        };
      },
    }),
  ],
  callbacks: {
    // `authorize` only runs at sign-in; the jwt callback is what carries those
    // fields forward on every later request, so anything the UI needs has to be
    // copied onto the token here or it will be missing.
    async jwt({ token, user }) {
      if (user) {
        const row = user as unknown as {
          role?: string;
          verification?: string;
        };
        token.id = user.id;
        token.role = row.role ?? "FARMER";
        token.verification = row.verification ?? "UNVERIFIED";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "FARMER";
        session.user.verification = token.verification ?? "UNVERIFIED";
        // The token carries only the id; the display name has to come from
        // somewhere, and a stale name in the cookie is better than none for
        // the length of a 30-day session.
        session.user.name = token.name ?? session.user.email ?? "ผู้ใช้งาน";
      }
      return session;
    },
  },
};
