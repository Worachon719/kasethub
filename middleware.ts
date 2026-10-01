import { withAuth } from "next-auth/middleware";

/**
 * Route protection for signed-in pages.
 *
 * `withAuth` rather than `getServerSession`, because the latter would pull
 * `lib/auth` — and through it Prisma — into the Edge bundle, which cannot run
 * the query engine. `withAuth` only needs the JWT and the secret, both of which
 * are available on the Edge.
 *
 * Pages listed in `matcher` require a session. API routes are deliberately not
 * covered: they need the caller's *role*, not just a session, so they call the
 * guards in lib/session inside the handler where the role is available.
 */
export default withAuth({
  pages: {
    // Unauthenticated visitors land here with ?callbackUrl set, so sign-in
    // resumes where they were heading.
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sell/:path*",
    "/deals/:path*",
    "/alerts/:path*",
  ],
};
