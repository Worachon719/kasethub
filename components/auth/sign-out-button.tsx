"use client";

import { signOut } from "next-auth/react";
import { useRef, useState } from "react";

/**
 * Sign out from the account menu.
 *
 * A full navigation follows so every server component re-reads the (now
 * absent) session; a client-side transition would leave the header rendering
 * the signed-in state until the next hard refresh.
 *
 * `signOut` does not reject on failure — it resolves either way — so the lock
 * is only released when the browser is still on the page, and a rejected
 * redirect would otherwise leave the button stuck on "กำลังออก…" forever.
 */
export function SignOutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        void signOut({ callbackUrl: "/" }).catch(() => {
          inFlight.current = false;
          setPending(false);
        });
      }}
      className={className}
    >
      {pending ? "กำลังออก…" : "ออกจากระบบ"}
    </button>
  );
}
