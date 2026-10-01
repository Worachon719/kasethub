import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { getTickerQuotes } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatThb } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "โบรกเกอร์และผู้ซื้อ" };

/** ติดต่อผู้รับซื้อ & โบรกเกอร์ — supplier directory ranked by escrow capacity. */
export default async function BrokersPage() {
  const tickerQuotes = await getTickerQuotes(6);

  const suppliers = process.env.DATABASE_URL
    ? await prisma.supplier.findMany({
        orderBy: [{ tier: "desc" }, { escrowCap: "desc" }],
        take: 60,
        include: {
          province: true,
          owner: {
            select: { nameTh: true, nameEn: true, ratingAvg: true, dealCount: true },
          },
          _count: { select: { lots: true } },
        },
      })
    : [];

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />
      <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
        <h1 className="text-3xl font-bold text-ink">
          โบรกเกอร์ & ผู้รับซื้อ
          <span className="block text-base font-normal text-ink-muted">
            Certified Wholesalers
          </span>
        </h1>

        {suppliers.length === 0 ? (
          <Card className="mt-6 p-8 text-center">
            <p className="font-semibold text-ink">
              ยังไม่มีข้อมูลผู้ให้บริการ
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              ตั้งค่า <code className="rounded bg-surface-2 px-1">DATABASE_URL</code>{" "}
              แล้วรัน <code className="rounded bg-surface-2 px-1">npm run db:seed</code>
            </p>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardHeader
              title="รายชื่อผู้ให้บริการ"
              subtitle={`${suppliers.length} รายการ · เรียงตามวงเงินประกัน`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase text-ink-muted">
                  <tr className="h-10">
                    <th className="px-4 text-left font-semibold">ชื่อ</th>
                    <th className="px-4 text-left font-semibold">ที่ตั้ง</th>
                    <th className="px-4 text-left font-semibold">ระดับ</th>
                    <th className="px-4 text-right font-semibold">ล็อต</th>
                    <th className="px-4 text-right font-semibold">วงเงิน Escrow</th>
                    <th className="px-4 text-right font-semibold">คะแนน</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr
                      key={s.id}
                      className="h-14 border-b border-hairline transition-colors hover:bg-[#f1f5f9]"
                    >
                      <td className="px-4">
                        <span className="font-semibold text-ink">{s.nameTh}</span>
                        {s.nameEn ? (
                          <span className="block text-xs text-ink-muted">
                            {s.nameEn}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 text-ink-secondary">
                        {[s.district, s.province?.nameTh]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </td>
                      <td className="px-4">
                        {s.tier === "CERTIFIED" ? (
                          <Badge tone="optimal">มาตรฐาน</Badge>
                        ) : s.tier === "VERIFIED" ? (
                          <Badge tone="optimal">ยืนยันแล้ว</Badge>
                        ) : (
                          <Badge>ยังไม่ยืนยัน</Badge>
                        )}
                      </td>
                      <td className="tabular px-4 text-right text-ink-secondary">
                        {s._count.lots}
                      </td>
                      <td className="tabular px-4 text-right font-semibold text-ink">
                        {s.escrowCap > 0 ? formatThb(s.escrowCap) : "—"}
                      </td>
                      <td className="tabular px-4 text-right text-ink-secondary">
                        ★ {s.owner.ratingAvg.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
