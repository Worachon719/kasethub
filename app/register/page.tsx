import type { Metadata } from "next";
import Link from "next/link";
import { RegisterWizard } from "@/components/auth/register-wizard";
import { prisma } from "@/lib/prisma";
import { registrationState } from "@/lib/registration";

export const metadata: Metadata = { title: "ลงทะเบียน" };
export const dynamic = "force-dynamic";

/**
 * ลงทะเบียน — four-step onboarding.
 *
 * Step 1 picks the role, which decides the rest of the form and the landing
 * page. The province list comes from the database so the KYC step stays in sync
 * with the geography the marketplace is seeded and filtered by; without a
 * database it falls back to an empty list and the field is simply skipped.
 *
 * Signup is gated by lib/registration. The gate is checked here as well as in
 * the API, so a closed form explains itself instead of letting a visitor fill in
 * four steps and fail on submit — and so the demo accounts stay the visible way
 * in once the gate closes.
 */
export default async function RegisterPage() {
  const provinces = process.env.DATABASE_URL
    ? await prisma.province
        .findMany({
          orderBy: [{ region: "asc" }, { nameTh: "asc" }],
          select: { id: true, nameTh: true },
        })
        .catch(() => [])
    : [];

  const gate = await registrationState();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-6 flex flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald">
          KasetHub Digital Exchange
        </span>
        <div className="mb-1 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald text-lg font-extrabold text-white">
            K
          </span>
          <span className="text-3xl font-extrabold tracking-tight text-ink">
            KasetHub
          </span>
        </div>
        <p className="max-w-lg text-base text-ink-secondary">
          ตลาดผลผลิตเกษตรกรไทย เชื่อมโยงตรงสู่ผู้รับซื้อ • Agri-Trading Trust Network
        </p>
      </header>

      <div className="mb-6 text-center">
        <span className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-harvest">
          <span aria-hidden>🔒</span>
          ระบบจับคู่การค้าผลผลิตเกษตรปลอดภัย 100% Guaranteed Escrow
        </span>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">
          ยินดีต้อนรับสู่ KasetHub! คุณต้องการใช้งานในฐานะใด?
        </h1>
        <p className="text-base text-ink-muted">
          เลือกประเภทบัญชีเพื่อรับเครื่องมือประมูล ข้อกำหนดสัญญา
          และการเข้าถึงตลาดตรงจุดที่สุด
        </p>
      </div>

      <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-hairline bg-surface-2 p-4 text-sm leading-relaxed text-ink-secondary">
        <p className="font-semibold text-ink">บัญชีสำหรับสาธิตระบบ</p>
        <p className="mt-1">
          ต้องการดูข้อมูลที่มีอยู่แล้วโดยไม่ต้องกรอกฟอร์ม?{" "}
          <Link href="/login" className="font-semibold text-emerald underline">
            เข้าสู่ระบบด้วยบัญชีทดลอง
          </Link>{" "}
          มีให้เลือกครบทั้งสามบทบาท (เกษตรกร โบรกเกอร์ ผู้ซื้อ)
        </p>

        {gate.open ? (
          <>
            <p className="mt-2 text-xs text-ink-muted">
              หน้านี้เปิดให้สมัครบัญชีใหม่ได้ทุกคน ข้อมูลที่สมัครจะถูกเก็บ
              ในฐานข้อมูลของระบบตัวอย่าง โดยไม่มีการส่งออกไปยังบริการอื่น
            </p>
            {gate.remaining !== null ? (
              <p className="mt-1 text-xs text-ink-muted">
                เหลือโควตาสมัครอีก {gate.remaining} บัญชี
                (เปิดให้สมัครทั้งหมด {gate.limit} บัญชี)
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 rounded-lg border border-hairline bg-canvas p-3 text-xs text-ink-secondary">
            <span aria-hidden>🔒 </span>
            {gate.reason === "full"
              ? "เต็มโควตาบัญชีสมัครของระบบตัวอย่างแล้ว "
              : "ปิดการสมัครบัญชีใหม่ชั่วคราว "}
            ยังเข้าใช้งานระบบได้ตามปกติด้วยบัญชีทดลองที่หน้าเข้าสู่ระบบ
          </p>
        )}
      </div>

      {gate.open ? (
        <RegisterWizard provinces={provinces} />
      ) : (
        <div className="mx-auto max-w-2xl rounded-xl border border-hairline bg-surface-2 p-8 text-center">
          <p className="text-base font-semibold text-ink">
            ปิดการรับสมัครบัญชีใหม่ชั่วคราว
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            ระบบอยู่ในช่วงสาธิต หากต้องการทดลองใช้งาน โปรดเข้าสู่ระบบด้วยบัญชีทดลอง
            ที่มีให้ครบทั้งสามบทบาท
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-emerald px-5 text-sm font-semibold text-white hover:bg-emerald-dark"
          >
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-ink-secondary">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="font-semibold text-emerald underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </main>
  );
}
