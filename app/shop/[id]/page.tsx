import Link from "next/link";
import { notFound } from "next/navigation";
import { LotGrid } from "@/components/lot-card";
import { MarketTicker } from "@/components/market-ticker";
import { ShopContact } from "@/components/shop/shop-contact";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { lotSelect, serializeLot } from "@/lib/lots";
import { prisma } from "@/lib/prisma";
import { getTickerQuotes } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * แผงผู้ขาย — a grower's public storefront at /shop/[id].
 *
 * The select below is the privacy boundary for the whole page. `phone`,
 * `email` and `whatsapp` are deliberately absent: a public page that exposes
 * a grower's number invites exactly the spam and harassment that publishing a
 * phone number in a marketplace guarantees, and the platform already has a
 * channel for real enquiries — the deal room, which is logged and tied to a
 * bid, so there is a record of who asked for what.
 */
const shopSelect = {
  id: true,
  nameTh: true,
  nameEn: true,
  avatarUrl: true,
  verification: true,
  ratingAvg: true,
  ratingCount: true,
  dealCount: true,
  shopName: true,
  shopDescription: true,
  // Only ever rendered as the "ติดต่อทาง LINE" button, and only when set, so
  // its presence is public information the grower opted into.
  lineId: true,
  district: true,
  province: { select: { nameTh: true, nameEn: true, region: true } },
} as const;

export default async function ShopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tickerQuotes = await getTickerQuotes(6);

  const [shop, lots] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: shopSelect }),
    prisma.lot.findMany({
      where: { farmerId: id, status: "ACTIVE" },
      // Soonest to spoil first, matching /market: a storefront is a list of
      // what you could buy right now, and the most perishable is the most
      // worth surfacing.
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
      take: 24,
      // The market's own select, so the card renders from the same shape it
      // does everywhere else rather than a second one that can drift.
      select: lotSelect,
    }),
  ]);

  // A grower with no shop name has no storefront — the page would be a name
  // and a province, which is not worth indexing.
  if (!shop || !shop.shopName) notFound();

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />

      <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
        <nav className="text-sm text-ink-muted">
          <Link href="/market" className="hover:text-ink">
            ตลาด
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{shop.shopName}</span>
        </nav>

        <header className="mt-4 rounded-2xl border border-hairline bg-white p-6 md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold text-ink">{shop.shopName}</h1>
                {shop.verification !== "UNVERIFIED" ? (
                  <Badge tone="optimal">✓ ยืนยันตัวตนแล้ว</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {shop.nameTh}
                {shop.province ? ` · จังหวัด${shop.province.nameTh}` : ""}
                {shop.district ? ` · ${shop.district}` : ""}
              </p>

              {shop.shopDescription ? (
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
                  {shop.shopDescription}
                </p>
              ) : null}
            </div>

            <ShopContact lineId={shop.lineId} shopName={shop.shopName} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline sm:grid-cols-4">
            {[
              {
                label: "คะแนน",
                value: shop.ratingCount ? shop.ratingAvg.toFixed(1) : "—",
              },
              { label: "รีวิว", value: shop.ratingCount.toLocaleString("th-TH") },
              { label: "ดีลสำเร็จ", value: shop.dealCount.toLocaleString("th-TH") },
              { label: "ล็อตที่เปิดขาย", value: lots.length.toLocaleString("th-TH") },
            ].map((stat) => (
              <div key={stat.label} className="bg-white px-4 py-3">
                <dt className="text-xs text-ink-muted">{stat.label}</dt>
                <dd className="tabular text-lg font-bold text-ink">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-ink">
            สินค้าที่กำลังประกาศขาย
            <span className="ml-2 text-sm font-normal text-ink-muted">
              {lots.length} ล็อต
            </span>
          </h2>

          {lots.length === 0 ? (
            <Card className="mt-4 p-8 text-center">
              <p className="font-semibold text-ink">ยังไม่มีสินค้าที่เปิดขาย</p>
              <p className="mt-1 text-sm text-ink-muted">
                ล็อตทั้งหมดของร้านนี้อาจถูกขายไปแล้ว หรือกำลังอยู่ระหว่างการเตรียมสินค้า
              </p>
            </Card>
          ) : (
            <div className="mt-4">
              <LotGrid lots={lots.map(serializeLot)} />
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
