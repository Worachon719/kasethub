import Link from "next/link";
import { AlertCard } from "@/components/alerts/alert-card";
import { WatchManager } from "@/components/alerts/watch-manager";
import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { getAlertMatches } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { getTickerQuotes } from "@/lib/queries";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "การแจ้งเตือนสินค้าใกล้หมดอายุ" };

/**
 * แจ้งเตือนสินค้าล้นสวน — a broker's saved watches and the lots matching them.
 *
 * Brokers and buyers only. The middleware already requires a session; the role
 * check here decides whether to render the tool or explain why it is not
 * available, so a farmer who follows a nav link gets a reason rather than a
 * 403.
 */
export default async function AlertsPage() {
  const user = await currentUser();
  const allowed = user?.role === "BROKER" || user?.role === "BUYER" || user?.role === "ADMIN";

  const tickerQuotes = await getTickerQuotes(6);

  if (!user || !allowed) {
    return (
      <>
        <MarketTicker quotes={tickerQuotes} />
        <SiteHeader />
        <main className="mx-auto max-w-canvas px-4 py-10 md:px-8">
          <h1 className="text-3xl font-bold text-ink">การแจ้งเตือนสินค้า</h1>
          <Card className="mt-6 p-8 text-center">
            <p className="font-semibold text-ink">เครื่องมือนี้สำหรับโบรกเกอร์และผู้ซื้อ</p>
            <p className="mt-1 text-sm text-ink-muted">
              {user
                ? "บัญชีของคุณเป็นเกษตรกร จึงไม่มีการแจ้งเตือนสินค้าล้นสวนจากเกษตรกรท่านอื่น"
                : "กรุณาเข้าสู่ระบบด้วยบัญชีโบรกเกอร์หรือผู้ซื้อเพื่อตั้งการเฝ้าดู"}
            </p>
            <Link
              href={user ? "/" : "/login?callbackUrl=/alerts"}
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-emerald px-5 text-sm font-bold text-white"
            >
              {user ? "กลับหน้าแรก" : "เข้าสู่ระบบ"}
            </Link>
          </Card>
        </main>
        <SiteFooter />
      </>
    );
  }

  const [watches, matches, provinces] = await Promise.all([
    prisma.brokerWatch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { province: { select: { id: true, nameTh: true } } },
    }),
    getAlertMatches(user.id),
    prisma.province.findMany({
      orderBy: { nameTh: "asc" },
      select: { id: true, nameTh: true },
    }),
  ]);

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />
      <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-bold text-ink">
            การแจ้งเตือนสินค้าใกล้หมดอายุ
            <span className="block text-base font-normal text-ink-muted">
              Surplus Alerts
            </span>
          </h1>
          {matches.length > 0 ? (
            <span className="rounded-full bg-harvest px-3 py-1 text-sm font-bold text-white tabular">
              {matches.length} ล็อตกำลังใกล้หมดอายุ
            </span>
          ) : null}
        </div>

        <div className="mt-6">
          <WatchManager
            provinces={provinces}
            watches={watches.map((w) => ({
              id: w.id,
              category: w.category,
              label: w.label,
              minQuantityKg: w.minQuantityKg,
              province: w.province,
            }))}
          />
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-ink">
            ล็อตที่ตรงกับการเฝ้าดูของคุณ
            <span className="ml-2 text-sm font-normal text-ink-muted">
              เรียงตามเวลาที่เหลือก่อนหมดอายุ
            </span>
          </h2>

          {watches.length === 0 ? (
            <Card className="mt-4 p-8 text-center">
              <p className="font-semibold text-ink">ยังไม่มีการเฝ้าดู</p>
              <p className="mt-1 text-sm text-ink-muted">
                เลือกหมวดสินค้าที่คุณต้องการ แล้วระบบจะแสดงล็อตที่ใกล้หมดอายุภายใน 2 วัน
                ให้อัตโนมัติ
              </p>
            </Card>
          ) : matches.length === 0 ? (
            <Card className="mt-4 p-8 text-center">
              <p className="font-semibold text-ink">
                ยังไม่มีล็อตที่ตรงกับการเฝ้าดู
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                ระบบจะแจ้งเตือนทันทีที่มีล็อตใกล้หมดอายุตรงกับเงื่อนไขของคุณ
                ลองเพิ่มจังหวัดอื่นหรือเอาข้อจำกัดปริมาณออกเพื่อดูสินค้าเพิ่ม
              </p>
            </Card>
          ) : (
            <div className="mt-4 space-y-3">
              {matches.map((lot) => (
                <AlertCard
                  key={lot.id}
                  lot={{ ...lot, matchCount: lot.watchIds.length }}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
