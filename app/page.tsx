import Link from "next/link";
import { LotGrid } from "@/components/lot-card";
import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMarketStats, getTickerQuotes, getUrgentLots } from "@/lib/queries";
import { CATEGORIES as CATEGORY_LIST } from "@/lib/categories";
import { formatThb, formatWeight } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Home category tiles, derived from the shared list so they track the filters. */
const CATEGORIES = CATEGORY_LIST.map((c) => ({
  href: `/market?category=${c.value}`,
  th: c.th,
  en: c.en,
  hint: c.hint,
}));

export default async function HomePage() {
  // Each call no-ops when DATABASE_URL is absent, keeping the page renderable.
  const [urgentLots, tickerQuotes, stats] = await Promise.all([
    getUrgentLots(8),
    getTickerQuotes(6),
    getMarketStats(),
  ]);

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-canvas px-4 py-10 md:px-8 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-optimal-bg px-3 py-1 text-xs font-semibold text-optimal-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
                ระบบระบายสต็อกผัก-ผลไม้ ก่อนเน่าเสีย
              </span>
              <h1 className="mt-4 text-[34px] font-extrabold leading-[42px] tracking-tight text-ink md:text-5xl md:leading-[56px]">
                ตลาดสินค้าเกษตรล้นสวน
                <span className="block text-emerald">
                  Surplus Produce Rescue Marketplace
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-secondary md:text-lg">
                เชื่อมเกษตรกรกับโบรกเกอร์และผู้ซื้อส่งออก ผ่านการประมูลแบบ
                Escrow พร้อมตัวชี้วัดความสด อายุเก็บรักษา และสถานะ Cold
                Chain แบบโปร่งใส
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/market" variant="transactional" size="lg">
                  เสนอราคา / Bid
                </ButtonLink>
                <ButtonLink href="/sell" variant="agrarian" size="lg">
                  ลงขายผลผลิต
                </ButtonLink>
              </div>
            </div>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">
                สรุปยอดระบายสต็อก
                <span className="block text-sm font-normal text-ink-muted">
                  Surplus Rescue Metric
                </span>
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <Metric
                  label="ล็อตที่เปิดขาย"
                  value={stats.activeLots.toLocaleString("th-TH")}
                />
                <Metric
                  label="สินค้าล้นสวน"
                  value={stats.surplusLots.toLocaleString("th-TH")}
                />
                <Metric
                  label="มูลค่าที่ระบายได้"
                  value={formatThb(stats.rescueValueThb)}
                />
                <Metric
                  label="จังหวัดที่ให้บริการ"
                  value={`${stats.provincesCovered} จังหวัด`}
                />
              </dl>
            </Card>
          </div>
        </section>

        {/* Urgent surplus rail */}
        <section className="mx-auto max-w-canvas px-4 pb-12 md:px-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-ink md:text-3xl">
                สินค้าล้นสวน ต้องการขายด่วน
              </h2>
              <p className="text-sm text-ink-muted">
                Urgent Surplus Lots — เรียงตามวันที่หมดอายุ
              </p>
            </div>
            <Link
              href="/market?surplusOnly=true"
              className="shrink-0 text-sm font-semibold text-emerald hover:underline"
            >
              ดูทั้งหมด →
            </Link>
          </div>
          <LotGrid lots={urgentLots} />
        </section>

        {/* Categories */}
        <section className="border-y border-hairline bg-white">
          <div className="mx-auto max-w-canvas px-4 py-12 md:px-8">
            <h2 className="text-2xl font-bold text-ink">
              เลือกสำรวจตามประเภทสินค้าเกษตร
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="rounded-xl border border-hairline bg-white p-4 transition-colors hover:border-emerald hover:bg-optimal-bg"
                >
                  <p className="font-semibold text-ink">{c.th}</p>
                  <p className="text-xs text-ink-muted">{c.en}</p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {c.hint}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="mx-auto max-w-canvas px-4 py-12 md:px-8">
          <h2 className="text-2xl font-bold text-ink">
            ความโปร่งใสของดีล
            <span className="block text-base font-normal text-ink-muted">
              Escrow Trust Gauge
            </span>
          </h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              { th: "วางเงินประกัน", en: "Escrow Deposited" },
              { th: "ตรวจสอบสินค้า", en: "Quality Inspected" },
              { th: "ขนส่งขึ้นรถ", en: "Loaded & Shipped" },
              { th: "ปล่อยเงินโอน", en: "Payment Released" },
            ].map((step, i) => (
              <li
                key={step.en}
                className="rounded-xl border border-hairline bg-white p-4"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 font-semibold text-ink">{step.th}</p>
                <p className="text-xs text-ink-muted">{step.en}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-ink-muted">
            หน่วยวัดตามมาตรฐานสากล: {formatWeight(1000)} = 1 ตัน · ราคาแสดงเป็น
            บาทต่อกิโลกรัม (THB/kg)
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-bold text-ink">{value}</dd>
    </div>
  );
}
