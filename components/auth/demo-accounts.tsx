"use client";

import { useState } from "react";

/**
 * Demo credential shortcuts.
 *
 * Every seeded account shares one password, so anyone opening the deployed
 * build can sign in as a farmer, a broker or a buyer without being handed a
 * spreadsheet. Each button fills the sign-in form rather than submitting it —
 * the presenter still presses the button, which keeps the credentials
 * provider (and its failure path) on the critical path for a live demo.
 *
 * The list is intentionally one account per role. Showing all seven reads as
 * a directory instead of a demo script, and the extra farmers add nothing when
 * the point is to show each role's permissions.
 */
const DEMO_ACCOUNTS = [
  {
    role: "เกษตรกร",
    roleEn: "Farmer",
    email: "somchai@kasethub.co",
    note: "ลงขายสินค้า เปิดร้านค้า",
    can: ["ลงประกาศขาย", "ตอบรับข้อเสนอ", "แก้ไขร้านค้า"],
  },
  {
    role: "โบรกเกอร์",
    roleEn: "Broker",
    email: "broker@bangkokfresh.co",
    note: "รวมกองและขายต่อ",
    can: ["สร้างร้านค้า", "เปิดเป็นร้านขายต่อ", "ลงประกาศขาย"],
  },
  {
    role: "ผู้ซื้อ",
    roleEn: "Buyer",
    email: "buyer@globalfruit.io",
    note: "ยื่นข้อเสนอและซื้อ",
    can: ["ประกาศราคาที่ต้องการ", "ส่งข้อเสนอ", "คุยกับเกษตรกร"],
  },
] as const;

/** Shared by every seeded account; kept in one place so the two files agree. */
export const DEMO_PASSWORD = "kasethub123";

export function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-ink"
      >
        <span>บัญชีสำหรับทดลองใช้งาน</span>
        <span className="text-ink-muted">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-ink-muted">
            ข้อมูลตัวอย่างจากชุดข้อมูลตั้งต้นสำหรับสาธิตระบบ ทุกบัญชีใช้รหัสผ่านเดียวกันคือ{" "}
            <code className="rounded bg-canvas px-1 py-0.5 font-mono text-[11px] text-ink">
              {DEMO_PASSWORD}
            </code>
          </p>

          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => onPick(a.email)}
              className="flex w-full items-start justify-between gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2 text-left transition-colors hover:border-emerald hover:bg-emerald-dark/5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {a.role}
                  <span className="ml-1 font-normal text-ink-muted">
                    {a.roleEn}
                  </span>
                </span>
                <span className="block truncate font-mono text-xs text-ink-secondary">
                  {a.email}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {a.can.join(" · ")}
                </span>
              </span>
              <span className="shrink-0 self-center text-xs font-semibold text-emerald">
                ใช้บัญชีนี้
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}