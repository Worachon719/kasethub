"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { DEMO_PASSWORD, DemoAccounts } from "@/components/auth/demo-accounts";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const ERROR_TEXT: Record<string, string> = {
  CredentialsSignin: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  SessionRequired: "กรุณาเข้าสู่ระบบก่อน",
};

/**
 * Credentials sign-in.
 *
 * Posts through next-auth/react so the session cookie and the client-side
 * session cache stay in step; `callbackUrl` is honoured and constrained to
 * same-origin paths by next-auth itself.
 */
export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Mirrors `pending` into a ref so a second click inside the same tick — before
  // React re-renders the disabled button — cannot fire a second signIn. The
  // ref updates synchronously; the state only drives the visible loading state.
  const inFlight = useRef(false);
  // Lets the demo-account shortcuts write straight into the form's own inputs.
  // They are uncontrolled, so assigning `.value` is enough — no state has to be
  // lifted out of the submit path just to support the shortcut buttons.
  const formRef = useRef<HTMLFormElement>(null);

  function fillDemo(email: string) {
    const form = formRef.current;
    if (!form) return;
    const emailField = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordField = form.elements.namedItem("password") as HTMLInputElement | null;
    if (emailField) emailField.value = email;
    if (passwordField) passwordField.value = DEMO_PASSWORD;
    setError(null);
    emailField?.focus();
  }

  if (status === "loading") {
    return <p className="text-sm text-ink-muted">กำลังตรวจสอบสถานะ…</p>;
  }

  if (session?.user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-secondary">
          เข้าสู่ระบบแล้วในชื่อ{" "}
          <span className="font-semibold text-ink">{session.user.name}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={callbackUrl}
            className="inline-flex h-11 items-center rounded-lg bg-emerald px-5 text-sm font-semibold text-white hover:bg-emerald-dark"
          >
            ดำเนินการต่อ
          </Link>
          <Button
            type="button"
            variant="neutral"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            ออกจากระบบ
          </Button>
        </div>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    inFlight.current = true;
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      const result = await signIn("credentials", {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError(ERROR_TEXT[result.error] ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      // Full navigation so the server components re-read the new session. The
      // lock is intentionally *not* released here — the page is navigating away
      // and a late double-submit must not re-trigger a sign-in.
      window.location.assign(result?.url ?? callbackUrl);
    } catch {
      inFlight.current = false;
      setPending(false);
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    }
  }

  return (
    <>
    <form onSubmit={onSubmit} ref={formRef} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">อีเมล / Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <Label htmlFor="password">รหัสผ่าน / Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-critical-border bg-critical-bg px-3 py-2 text-sm font-semibold text-critical-fg"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="agrarian"
        className="w-full"
        disabled={pending}
      >
        {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
      </Button>
    </form>

    <DemoAccounts onPick={fillDemo} />
    </>
  );
}
