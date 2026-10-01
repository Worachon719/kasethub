"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client boundary for next-auth's session hooks.
 *
 * Mounted in the root layout so any component can call useSession without the
 * rest of the tree becoming client-rendered.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
