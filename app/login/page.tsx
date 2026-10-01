import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "เข้าสู่ระบบ KasetHub — มีบัญชีทดลองใช้งานให้กดเลือกได้ทันที",
};

/**
 * Sign-in surface.
 *
 * Credentials go through next-auth's credentials provider, which validates
 * against the bcrypt hash on the user row and stores a database session.
 * `callbackUrl` is read on the server and passed down so a visitor bounced by
 * middleware resumes where they were going; it is only accepted when it is a
 * relative path, which blocks open-redirect attempts through the query param.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { callbackUrl: raw } = await searchParams;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  // Leading slash without a protocol prefix = same-origin path.
  const callbackUrl =
    requested && /^\/(?!\/)/.test(requested) ? requested : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-ink">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-ink-muted">
          เข้าสู่ระบบเพื่อประกาศขาย ส่งข้อเสนอ และเจรจาราคากับคู่ค้า
        </p>

        <Suspense
          fallback={<p className="mt-6 text-sm text-ink-muted">กำลังโหลด…</p>}
        >
          <LoginForm callbackUrl={callbackUrl} />
        </Suspense>

        <p className="mt-6 border-t border-hairline pt-4 text-sm text-ink-secondary">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="font-semibold text-emerald underline">
            ลงทะเบียนเป็นเกษตรกรหรือผู้ซื้อ
          </Link>
        </p>
      </Card>
    </main>
  );
}
