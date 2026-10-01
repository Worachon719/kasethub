import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LotForm } from "@/components/lots/lot-form";
import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { getTickerQuotes } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "ลงขายผลผลิต" };
export const dynamic = "force-dynamic";

/**
 * ลงขายผลผลิต — farmer listing form.
 *
 * Farmer-only, matching POST /api/lots. middleware already bounces anonymous
 * visitors, so this check exists for the role rather than the session. Buyers
 * and brokers get an explanation instead of a dead form.
 */
export default async function SellPage() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=%2Fsell");

  if (user.role !== "FARMER" && user.role !== "ADMIN") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-canvas px-4 py-16 md:px-8">
          <Card className="mx-auto max-w-lg p-8 text-center">
            <h1 className="text-xl font-bold text-ink">
              หน้านี้สำหรับเกษตรกรเท่านั้น
            </h1>
            <p className="mt-2 text-sm text-ink-secondary">
              บัญชีของคุณมีบทบาทเป็น{" "}
              <span className="font-semibold text-ink">{user.role}</span> ซึ่งเป็นฝ่าย
              ผู้ซื้อ หากต้องการลงขายผลผลิตของตนเอง โปรดสมัครบัญชีประเภทเกษตรกร
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link
                href="/market"
                className="inline-flex h-11 items-center rounded-lg border-[1.5px] border-hairline bg-white px-5 text-sm font-semibold text-ink hover:bg-surface-2"
              >
                ไปที่ตลาด
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-lg bg-emerald px-5 text-sm font-semibold text-white hover:bg-emerald-dark"
              >
                สมัครเป็นเกษตรกร
              </Link>
            </div>
          </Card>
        </main>
        <SiteFooter />
      </>
    );
  }

  const [provinces, tickerQuotes] = await Promise.all([
    process.env.DATABASE_URL
      ? prisma.province
          .findMany({
            orderBy: [{ region: "asc" }, { nameTh: "asc" }],
            select: { id: true, nameTh: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    getTickerQuotes(6),
  ]);

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="text-3xl font-bold text-ink">
          ลงขายผลผลิต
          <span className="block text-base font-normal text-ink-muted">
            List Your Surplus
          </span>
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          ระบายสต็อกก่อนเน่าเสียให้โรงงาน ผู้รับซื้อ และผู้ส่งออกเข้าถึงโดยตรง
          ล็อตของคุณจะผูกกับบัญชี <span className="font-semibold text-ink">{user.name}</span>
        </p>

        <div className="mt-6">
          <LotForm provinces={provinces} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
