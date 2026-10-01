"use client";

import Link from "next/link";
import { Countdown } from "@/components/ui/countdown";
import { SpoilageBadge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/categories";
import { formatPricePerKg, formatWeight, daysUntil, spoilageLevel } from "@/lib/utils";

type AlertLot = {
  id: string;
  lotCode: string;
  titleTh: string;
  variety: string | null;
  category: string;
  askPricePerKg: number;
  availableQtyKg: number | null;
  minOrderKg: number;
  provinceNameTh: string | null;
  imageUrl: string | null;
  expiresAt: string | null;
  auctionEndsAt: string | null;
  watchIds: string[];
  matchCount: number;
};

/**
 * One urgent lot in the alert list.
 *
 * Purpose-built rather than reusing LotCard: the card is optimised for browsing
 * a catalogue where the buyer compares many lots at their own pace. An alert is
 * a different job — it is a single lot the buyer has been told to act on *now*,
 * so it leads with the countdown, then the price, and the primary action is
 * "เสนอราคา" rather than "ดูรายละเอียด".
 */
export function AlertCard({ lot }: { lot: AlertLot }) {
  const level = spoilageLevel(lot.expiresAt);
  const days = lot.expiresAt ? daysUntil(lot.expiresAt) : null;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-hairline bg-white p-4 sm:flex-row md:p-5">
      <Link
        href={`/lots/${lot.id}`}
        className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-48"
      >
        {lot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.imageUrl}
            alt={lot.titleTh}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-ink-muted">
            ไม่มีรูปภาพ
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-surface-2/90 px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
          {categoryLabel(lot.category)}
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <Link href={`/lots/${lot.id}`} className="hover:underline">
            <h3 className="text-base font-bold leading-snug text-ink">
              {lot.titleTh}
            </h3>
          </Link>
          <p className="text-xs text-ink-muted">
            {lot.variety ? `${lot.variety} · ` : ""}
            {lot.provinceNameTh ?? "ไม่ระบุจังหวัด"} ·{" "}
            <span className="tabular">{lot.lotCode}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The alert query only ever returns lots with an expiry, but the
              badge requires a number rather than a nullable one, so guard
              rather than inventing a 0 that would read as "expires today". */}
          {days !== null ? <SpoilageBadge level={level} days={days} /> : null}
          {lot.matchCount > 1 ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
              ตรงกับ {lot.matchCount} การเฝ้าดู
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tabular text-xl font-bold text-emerald">
              {formatPricePerKg(lot.askPricePerKg)}
            </p>
            <p className="text-xs text-ink-muted">
              เหลือ{" "}
              <span className="tabular">
                {formatWeight(lot.availableQtyKg ?? 0)}
              </span>{" "}
              · ขั้นต่ำ{" "}
              <span className="tabular">{formatWeight(lot.minOrderKg)}</span>
            </p>
          </div>

          <Link
            href={`/lots/${lot.id}#bid`}
            className="inline-flex h-10 shrink-0 items-center rounded-xl bg-harvest px-5 text-sm font-bold text-white transition-colors hover:bg-harvest-dark"
          >
            เสนอราคา
          </Link>
        </div>

        {/* Expiry first, then the auction if the lot is also being auctioned —
            a broker needs both clocks, and the auction usually closes first. */}
        <div className="mt-auto space-y-1.5 pt-1">
          <Countdown target={lot.expiresAt} label="หมดอายุใน" />
          {lot.auctionEndsAt ? (
            <Countdown target={lot.auctionEndsAt} label="ปิดประมูลใน" />
          ) : null}
        </div>
      </div>
    </article>
  );
}
