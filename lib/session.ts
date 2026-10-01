import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export type SessionRole = "FARMER" | "BROKER" | "BUYER" | "ADMIN";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: SessionRole;
  verification: string;
};

/**
 * Resolve the signed-in user from the session cookie.
 *
 * The role is re-read from the database rather than taken from the token. The
 * token is a JWT that lives for 30 days, so a role taken from it would keep
 * granting its old permissions for a month after the account was changed — a
 * demoted broker could keep placing bids the whole time. One indexed lookup is
 * a fair price for authorization that reflects the current record.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      email: true,
      nameTh: true,
      nameEn: true,
      role: true,
      verification: true,
    },
  });

  // A token that outlived its user: the account was deleted, or the DB is
  // unreachable. Either way there is no usable session.
  if (!user) return null;

  return {
    id,
    email: user.email,
    name: session.user.name ?? user.nameTh ?? user.nameEn ?? user.email,
    role: user.role,
    verification: user.verification,
  };
}

/**
 * Resolve the current user or throw a 401 HttpError.
 *
 * Route handlers call this instead of reading an id off the request body, so
 * the acting user can only ever come from a verified session.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError("Authentication required", 401);
  return user;
}

/** Resolve the current user and assert they hold one of `roles`. */
export async function requireRole(
  ...roles: SessionRole[]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new HttpError(
      `Requires one of: ${roles.join(", ")}`,
      403,
      { userRole: user.role },
    );
  }
  return user;
}
