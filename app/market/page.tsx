import { Suspense } from "react";
import { LotGrid, LotList, LotCardSkeleton } from "@/components/lot-card";
import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { buildLotOrderBy, buildLotWhere, getLotFacets } from "@/lib/lot-query";
import { CATEGORIES } from "@/lib/categories";
import { lotSelect, serializeLot } from "@/lib/lots";
import { prisma } from "@/lib/prisma";
import { getTickerQuotes } from "@/lib/queries";
import { cn, formatThb } from "@/lib/utils";
import { lotQuerySchema, type LotQuery, type Urgency } from "@/lib/validations";

export const dynamic = "force-dynamic";

const REGION_OPTIONS = [
  { value: "", label: "ทุกเขตพื้นที่ (All Regions)" },
  { value: "NORTH", label: "ภาคเหนือ" },
  { value: "NORTHEAST", label: "ภาคอีสาน" },
  { value: "CENTRAL", label: "ภาคกลาง & ปริมณฑล" },
  { value: "EAST", label: "ภาคตะวันออก" },
  { value: "WEST", label: "ภาคตะวันตก" },
  { value: "SOUTH", label: "ภาคใต้" },
];

/** ความเร่งด่วน — the design's urgency rail. */
const URGENCY_OPTIONS: { value: Urgency; label: string; hint: string }[] = [
  { value: "critical", label: "วิกฤต", hint: "หมดอายุภายใน 24 ชม." },
  { value: "urgent", label: "ด่วน", hint: "1-2 วัน" },
  { value: "moderate", label: "ปานกลาง", hint: "3-5 วัน" },
  { value: "normal", label: "มีเวลา", hint: "มากกว่า 5 วัน" },
];

/** ขนาดขั้นต่ำ — lot-size chips, so a buyer can jump to bulk supply. */
const LOT_SIZE_CHIPS = [
  { value: "", label: "ทุกขนาด" },
  { value: "100", label: "100 กก. +" },
  { value: "500", label: "500 กก. +" },
  { value: "1000", label: "1 ตัน +" },
  { value: "5000", label: "5 ตัน +" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "ลงใหม่ล่าสุด" },
  { value: "expiring", label: "ใกล้หมดอายุมากที่สุด" },
  { value: "price_desc", label: "ราคาเสนอสูงสุด" },
  { value: "price_asc", label: "ราคาต่ำสุด" },
  { value: "volume", label: "ปริมาณมากที่สุด" },
  { value: "rating", label: "คะแนนชาวสวนสูงสุด" },
];

type View = "grid" | "list";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

/** Rebuild the query string with overrides, dropping empty values. */
function hrefWith(
  searchParams: SearchParams,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    const value = first(v);
    if (value) params.set(k, value);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) params.delete(k);
    else if (v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/market?${qs}` : "/market";
}

/** ตลาดสินค้าล้นสวน — search, facet, sort, and paginate the marketplace. */
export default async function MarketPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Awaited once into a local with the old name, so the value keeps flowing
  // into `hrefWith`, `FilterPanel` and `Results` — all of which are ordinary
  // components and still take the resolved object synchronously.
  const searchParams = await searchParamsPromise;
  const tickerQuotes = await getTickerQuotes(6);
  const view = first(searchParams.view) === "list" ? "list" : "grid";

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />

      <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink">
              ตลาดสินค้าล้นสวน
              <span className="block text-base font-normal text-ink-muted">
                Surplus Marketplace
              </span>
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              ระบายสต็อกเกษตรก่อนเน่าเสีย พร้อมเงินค้ำประกันและการเจรจาโดยตรง
            </p>
          </div>

          {/* Grid / list toggle — plain links, so it works without JS. */}
          <div className="flex overflow-hidden rounded-lg border border-hairline bg-white">
            {(
              [
                { value: "grid", label: "ตาราง", icon: "▦" },
                { value: "list", label: "รายการ", icon: "☰" },
              ] as const
            ).map((option) => (
              <a
                key={option.value}
                href={hrefWith(searchParams, { view: option.value })}
                aria-current={view === option.value ? "true" : undefined}
                className={cn(
                  "flex h-10 items-center gap-1.5 px-4 text-sm font-semibold transition-colors",
                  view === option.value
                    ? "bg-emerald text-white"
                    : "text-ink-secondary hover:bg-surface-2",
                )}
              >
                <span aria-hidden>{option.icon}</span>
                {option.label}
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside>
            <FilterPanel searchParams={searchParams} />
          </aside>

          <section>
            <Suspense key={JSON.stringify(searchParams)} fallback={<GridSkeleton />}>
              <Results searchParams={searchParams} view={view} />
            </Suspense>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function FilterPanel({ searchParams }: { searchParams: SearchParams }) {
  const get = (k: string) => first(searchParams[k]);

  const parsed = lotQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(searchParams).map(([k, v]) => [k, first(v)]),
    ),
  );
  const query: LotQuery = parsed.success
    ? parsed.data
    : lotQuerySchema.parse({});

  const facets = await getLotFacets(query);

  return (
    <Card className="sticky top-28 max-h-[calc(100vh-9rem)] overflow-y-auto p-5">
      <h2 className="text-lg font-semibold text-ink">ตัวกรอง</h2>

      {/* Marketplace summary — the design's "ภาพรวมสต็อกล้นสวนทั้งหมด" strip. */}
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <Stat
          label="สต็อกล้นสวน"
          value={String(facets.total)}
          tone="ink"
        />
        <Stat
          label="ล็อตวิกฤต"
          value={String(facets.criticalCount)}
          tone="harvest"
        />
        <Stat
          label="มูลค่าที่ช่วยได้"
          value={formatThb(facets.rescueValueThb)}
          tone="emerald"
          wide
        />
      </dl>

      <form action="/market" method="get" className="mt-5 space-y-5">
        {/* View is a display preference, not a filter, so it rides along. */}
        {get("view") ? <input type="hidden" name="view" value={get("view")} /> : null}

        <div>
          <Label htmlFor="q">ค้นหาสินค้า</Label>
          <Input
            id="q"
            name="q"
            defaultValue={get("q")}
            placeholder="มะม่วงน้ำดอกไม้, ทุเรียน..."
          />
        </div>

        {/* Urgency rail — counts come from the shared facet query. */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-secondary">
            ความเร่งด่วน
          </legend>
          <div className="space-y-1.5">
            <FacetRow
              href={hrefWith(searchParams, { urgency: undefined })}
              label="ทุกระดับ"
              count={query.urgency ? undefined : facets.total}
              active={!query.urgency}
            />
            {URGENCY_OPTIONS.map((option) => {
              const count = facets.urgency[option.value];
              return (
                <FacetRow
                  key={option.value}
                  href={hrefWith(searchParams, { urgency: option.value, page: undefined })}
                  label={option.label}
                  hint={option.hint}
                  count={count}
                  active={query.urgency === option.value}
                  tone={option.value === "critical" ? "critical" : undefined}
                />
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-secondary">
            ประเภทสินค้า
          </legend>
          <div className="space-y-1.5">
            <FacetRow
              href={hrefWith(searchParams, { category: undefined })}
              label="ทั้งหมด"
              count={query.category ? undefined : facets.total}
              active={!query.category}
            />
            {CATEGORIES.map((c) => (
              <FacetRow
                key={c.value}
                href={hrefWith(searchParams, {
                  category: c.value,
                  page: undefined,
                })}
                label={c.th}
                hint={c.en}
                count={facets.category[c.value] ?? 0}
                active={query.category === c.value}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-secondary">
            เขตพื้นที่
          </legend>
          <div className="space-y-1.5">
            <FacetRow
              href={hrefWith(searchParams, {
                region: undefined,
                province: undefined,
              })}
              label="ทั้งหมด"
              count={query.region || query.province ? undefined : facets.total}
              active={!query.region && !query.province}
            />
            {REGION_OPTIONS.filter((o) => o.value).map((option) => (
              <FacetRow
                key={option.value}
                href={hrefWith(searchParams, {
                  region: option.value,
                  province: undefined,
                  page: undefined,
                })}
                label={option.label}
                count={facets.region[option.value] ?? 0}
                active={query.region === option.value}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-secondary">
            ขนาดขั้นต่ำ
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {LOT_SIZE_CHIPS.map((chip) => {
              const active = (get("minQty") || "") === chip.value;
              return (
                <a
                  key={chip.value}
                  href={hrefWith(searchParams, {
                    minQty: chip.value || undefined,
                    page: undefined,
                  })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "border-emerald bg-emerald text-white"
                      : "border-hairline bg-white text-ink-secondary hover:bg-surface-2",
                  )}
                >
                  {chip.label}
                </a>
              );
            })}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="province">ค้นด้วยจังหวัด</Label>
          <Input
            id="province"
            name="province"
            defaultValue={get("province")}
            placeholder="เช่น เชียงใหม่, จันทบุรี"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="minPrice">ราคาต่ำสุด</Label>
            <Input
              id="minPrice"
              name="minPrice"
              type="number"
              min={0}
              step="0.5"
              defaultValue={get("minPrice")}
              placeholder="฿"
            />
          </div>
          <div>
            <Label htmlFor="maxPrice">ราคาสูงสุด</Label>
            <Input
              id="maxPrice"
              name="maxPrice"
              type="number"
              min={0}
              step="0.5"
              defaultValue={get("maxPrice")}
              placeholder="฿"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              name="surplusOnly"
              value="true"
              defaultChecked={query.surplusOnly}
              className="h-5 w-5 rounded border-2 border-[#cbd5e1] text-emerald"
            />
            เฉพาะสินค้าล้นสวน
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              name="organic"
              value="true"
              defaultChecked={query.organic}
              className="h-5 w-5 rounded border-2 border-[#cbd5e1] text-emerald"
            />
            ออร์แกนิก
          </label>
        </div>

        <div>
          <Label htmlFor="sort">เรียงตาม</Label>
          <Select id="sort" name="sort" defaultValue={get("sort") || "newest"}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="agrarian" className="flex-1">
            ค้นหา
          </Button>
          <Button type="reset" variant="neutral">
            ล้าง
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: string;
  tone: "ink" | "harvest" | "emerald";
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-hairline bg-surface-2 p-3",
        wide && "col-span-2",
      )}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "tabular mt-0.5 text-lg font-extrabold",
          tone === "harvest" && "text-harvest",
          tone === "emerald" && "text-emerald",
          tone === "ink" && "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * A single selectable facet with its count.
 *
 * `count` is undefined when the facet is the one currently narrowing the
 * result set — showing the filtered count there would be a tautology — in
 * which case the row is still rendered so the current selection stays visible.
 */
function FacetRow({
  href,
  label,
  hint,
  count,
  active,
  tone,
}: {
  href: string;
  label: string;
  hint?: string;
  count?: number;
  active: boolean;
  tone?: "critical";
}) {
  return (
    <a
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-optimal-bg font-bold text-optimal-fg"
          : "text-ink-secondary hover:bg-surface-2",
      )}
    >
      <span className="min-w-0 truncate">
        {label}
        {hint ? (
          <span className="block truncate text-[11px] font-normal text-ink-muted">
            {hint}
          </span>
        ) : null}
      </span>
      {count !== undefined ? (
        <span
          className={cn(
            "tabular shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink-muted",
            tone === "critical" && count > 0 && "bg-critical-bg text-critical-fg",
            active && "bg-white",
          )}
        >
          {count}
        </span>
      ) : null}
    </a>
  );
}

async function Results({
  searchParams,
  view,
}: {
  searchParams: SearchParams;
  view: View;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    const value = first(v);
    if (value) params.set(k, value);
  }

  const parsed = lotQuerySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    return (
      <p className="rounded-xl border border-critical-border bg-critical-bg p-4 text-sm text-critical-fg">
        พารามิเตอร์ไม่ถูกต้อง กรุณาตรวจสอบตัวกรองอีกครั้ง
      </p>
    );
  }

  const query: LotQuery = parsed.data;

  if (!process.env.DATABASE_URL) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold text-ink">ยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
        <p className="mt-1 text-sm text-ink-muted">
          ตั้งค่า <code className="rounded bg-surface-2 px-1">DATABASE_URL</code>{" "}
          ใน <code className="rounded bg-surface-2 px-1">.env.local</code> แล้วรัน{" "}
          <code className="rounded bg-surface-2 px-1">npm run prisma:push</code> —
          ดูรายละเอียดใน README
        </p>
      </Card>
    );
  }

  // Shared query builder keeps the page and /api/lots consistent.
  const where = buildLotWhere(query);
  const orderBy = buildLotOrderBy(query.sort);

  const [total, rows] = await prisma.$transaction([
    prisma.lot.count({ where }),
    prisma.lot.findMany({
      where,
      orderBy,
      select: lotSelect,
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
  ]);

  const lots = rows.map(serializeLot);
  const totalPages = Math.max(1, Math.ceil(total / query.perPage));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">
          พบ <span className="tabular font-bold text-ink">{total}</span> ล็อต
          {query.surplusOnly ? " (สินค้าล้นสวน)" : ""}
        </p>
        <p className="tabular text-sm text-ink-muted">
          หน้า {query.page} / {totalPages}
        </p>
      </div>

      {view === "list" ? <LotList lots={lots} /> : <LotGrid lots={lots} />}

      {totalPages > 1 ? (
        <nav className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={hrefWith(searchParams, { page: String(p) })}
              aria-current={p === query.page ? "page" : undefined}
              className={cn(
                "tabular flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold",
                p === query.page
                  ? "border-emerald bg-emerald text-white"
                  : "border-hairline bg-white text-ink-secondary hover:bg-surface-2",
              )}
            >
              {p}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <LotCardSkeleton key={i} />
      ))}
    </div>
  );
}
