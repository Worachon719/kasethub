import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client.
 *
 * In development, Next.js hot-reloads modules on every edit, so we cache the
 * instance on globalThis to avoid exhausting the Postgres connection pool.
 * In production (Vercel) each lambda invocation gets a fresh module scope, so a
 * plain new client is created and closed when the lambda is frozen.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
