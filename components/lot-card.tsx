import Link from "next/link";
import { GradeBadge, SpoilageBadge, VerifiedBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import type { LotListItem } from "@/lib/lots";
import { categoryLabel } from "@/lib/categories";
import {
  cn,
  daysUntil,
  formatPricePerKg,
  formatThb,
  formatWeight,
  spoilageLevel,
} from "@/lib/utils";

export function LotCard({ lot }: { lot: LotListItem }) {
  const level = spoilageLevel(lot.expiresAt);
  const days = lot.expiresAt ? daysUntil(lot.expiresAt) : null;
  const urgent = level === "critical";

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-white transition-colors hover:border-[#cbd5e1]",
        urgent && "border-amber/40 surface-attention",
      )}
    >
      {/* Image header — 4:3 with floating urgency / location chips */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {lot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.imageUrl}
            alt={lot.titleTh}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-ink-muted">
            ไม่มีรูปภาพ
          </div>
        )}

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {lot.isSurplus ? (
              <span className="rounded-full bg-harvest px-2 py-1 text-[11px] font-bold text-white">
                สินค้าล้นสวน
              </span>
            ) : null}
            {days !== null ? (
              <SpoilageBadge level={level} days={days} />
            ) : null}
          </div>
          {lot.provinceNameTh ? (
            <span className="glass rounded-full px-2 py-1 text-[11px] font-semibold text-ink-secondary">
              {lot.provinceNameTh}
            </span>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold leading-snug text-ink">
            {lot.titleTh}
            <span className="mt-0.5 block text-xs font-normal text-ink-muted">
              {lot.titleEn}
            </span>
          </h3>
          <GradeBadge grade={lot.grade} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
          {/* Category is the primary facet, so it leads the badge row. */}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
            {categoryLabel(lot.category)}
          </span>
          {lot.farmerVerification && lot.farmerVerification !== "UNVERIFIED" ? (
            <VerifiedBadge />
          ) : null}
          {/*
            Storefront link, only when one exists. Pointing at /shop/<id> for a
            grower with no shop name would 404, and farmerShopName is the flag
            that says whether the page is there.
          */}
          {lot.farmerId && lot.farmerShopName ? (
            <Link
              href={`/shop/${lot.farmerId}`}
              className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-secondary hover:bg-optimal-bg hover:text-optimal-fg"
              title={`ดูร้าน ${lot.farmerShopName}`}
            >
              🏪 {lot.farmerShopName}
            </Link>
          ) : null}
          {lot.farmerRatingAvg ? (
            <span className="tabular">
              ★ {lot.farmerRatingAvg.toFixed(1)} ({formatWeight(lot.quantityKg)})
            </span>
          ) : null}
          {lot.organic ? (
            <span className="rounded-full bg-optimal-bg px-2 py-0.5 text-[11px] font-semibold text-optimal-fg">
              ออร์แกนิก
            </span>
          ) : null}
          {lot.gapCertified ? (
            <span className="rounded-full bg-optimal-bg px-2 py-0.5 text-[11px] font-semibold text-optimal-fg">
              GAP
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex items-end justify-between">
          <div>
            <div className="text-xl font-extrabold tabular text-ink">
              {formatPricePerKg(lot.askPricePerKg)}
            </div>
            <div className="text-xs text-ink-muted">
              ขั้นต่ำ {formatWeight(lot.minOrderKg)} · เหลือ{" "}
              {formatWeight(lot.availableQtyKg)}
            </div>
          </div>
          {lot.bidCount > 0 ? (
            <span className="tabular rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-secondary">
              {lot.bidCount} ข้อเสนอ
            </span>
          ) : null}
        </div>

        {lot.auctionEndsAt ? (
          <Countdown target={lot.auctionEndsAt} label="ปิดประมูลใน" />
        ) : null}
      </div>

      {/* Footer CTA */}
      <div className="flex items-center gap-2 border-t border-hairline p-4 md:px-6">
        <ButtonLink
          href={`/lots/${lot.id}`}
          variant="transactional"
          size="sm"
          className="flex-1"
        >
          เสนอราคา / Bid
        </ButtonLink>
        <ButtonLink href={`/lots/${lot.id}`} variant="neutral" size="sm">
          รายละเอียด
        </ButtonLink>
      </div>
    </article>
  );
}

export function LotCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-white">
      <div className="aspect-[4/3] animate-pulse bg-surface-2" />
      <div className="space-y-2 p-4 md:p-6">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
        <div className="h-7 w-1/3 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}

export function LotGrid({ lots }: { lots: LotListItem[] }) {
  if (lots.length === 0) {
    return <EmptyResults />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lots.map((lot) => (
        <LotCard key={lot.id} lot={lot} />
      ))}
    </div>
  );
}

/**
 * Dense table-style rows for buyers comparing many lots at once.
 *
 * The grid view leads with the photo; this one leads with the numbers a
 * procurement lead scans for — price, volume, remaining shelf life — so the
 * image is a small thumbnail rather than the anchor.
 */
export function LotList({ lots }: { lots: LotListItem[] }) {
  if (lots.length === 0) {
    return <EmptyResults />;
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-hairline bg-white">
      {lots.map((lot) => {
        const level = spoilageLevel(lot.expiresAt);
        const days = lot.expiresAt ? daysUntil(lot.expiresAt) : null;

        return (
          <li
            key={lot.id}
            className="flex flex-wrap items-center gap-4 border-b border-hairline p-3 last:border-b-0 hover:bg-surface-2"
          >
            <Link
              href={`/lots/${lot.id}`}
              className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2"
            >
              {lot.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lot.imageUrl}
                  alt={lot.titleTh}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </Link>

            <div className="min-w-[12rem] flex-1">
              <Link
                href={`/lots/${lot.id}`}
                className="block truncate text-sm font-bold text-ink hover:text-emerald"
              >
                {lot.titleTh}
              </Link>
              <p className="truncate text-xs text-ink-muted">
                <span className="tabular">{lot.lotCode}</span>
                {lot.provinceNameTh ? ` · ${lot.provinceNameTh}` : ""}
                {lot.farmerName ? ` · ${lot.farmerName}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <GradeBadge grade={lot.grade} />
                {days !== null ? (
                  <SpoilageBadge level={level} days={days} />
                ) : null}
                {lot.isSurplus ? (
                  <span className="rounded-full bg-harvest px-2 py-0.5 text-[11px] font-bold text-white">
                    ล้นสวน
                  </span>
                ) : null}
              </div>
            </div>

            <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-ink-muted">ราคา/กก.</dt>
                <dd className="font-bold text-ink">
                  {formatThb(lot.askPricePerKg)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">เหลือ</dt>
                <dd className="font-semibold text-ink">
                  {formatWeight(lot.availableQtyKg)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">ข้อเสนอ</dt>
                <dd className="font-semibold text-ink">{lot.bidCount} รายการ</dd>
              </div>
            </dl>

            <ButtonLink
              href={`/lots/${lot.id}`}
              variant="transactional"
              size="sm"
              className="ml-auto"
            >
              เสนอราคา
            </ButtonLink>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyResults() {
  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-white p-12 text-center">
      <p className="text-sm font-semibold text-ink">ไม่พบล็อตที่ตรงกับเงื่อนไข</p>
      <p className="mt-1 text-sm text-ink-muted">
        ลองปรับตัวกรองจังหวัดหรือช่วงราคา · ดู{" "}
        <Link href="/market" className="text-emerald underline">
          ตารางราคาตลาด
        </Link>
      </p>
    </div>
  );
}

export { formatThb };
