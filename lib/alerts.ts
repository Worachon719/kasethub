/**
 * Surplus alerts: matching a broker's saved watches against at-risk lots.
 *
 * The matching is computed at read time rather than materialised into an alert
 * table. That is a deliberate trade: a stored `Alert` row would need a
 * background job to create, a sweep to expire, and a cascade to clean up, and
 * the moment any of those lapses the broker is looking at a stale list. A
 * watch here is just a saved filter, so it cannot go stale — widening the
 * urgency window is a constant change, and deleting a lot removes it from every
 * match with no sweep.
 *
 * The cost is that every /alerts render runs one indexed query. At the scale a
 * marketplace reaches where that matters, materialise; the query is written so
 * that move is a change of this function's internals only.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lotSelect, serializeLot } from "@/lib/lots";

const DAY_MS = 86_400_000;

/**
 * Lots expiring within this window are surfaced by a watch.
 *
 * Two days, matching the market's "urgent" facet boundary: below 24h is
 * critical, 24-48h is urgent, and a broker who watches a category wants
 * everything in both. A watch is about *acting before it spoils*, so widening
 * this to include the 2-5 day "moderate" bucket would bury the lots that
 * actually need a call today.
 */
export const ALERT_WINDOW_DAYS = 2;

/** A lot is urgent if it expires in (now, now + ALERT_WINDOW_DAYS]. */
export function alertWindow(): Prisma.DateTimeFilter {
  const now = Date.now();
  return {
    gt: new Date(now),
    lte: new Date(now + ALERT_WINDOW_DAYS * DAY_MS),
  };
}

/** True when a watch's criteria are satisfied by a lot row. */
type WatchCriteria = {
  category: string;
  provinceId: string | null;
  minQuantityKg: number | null;
};

/**
 * Build one `where` clause that matches lots satisfying *any* of the watches.
 *
 * An empty watch list yields `null`, which the caller must treat as "nothing
 * matches" — returning `{ OR: [] }` would silently match every lot, which is
 * the opposite of what an empty watch list means.
 */
export function buildAlertWhere(
  watches: readonly WatchCriteria[],
): Prisma.LotWhereInput | null {
  if (watches.length === 0) return null;

  return {
    status: "ACTIVE",
    expiresAt: alertWindow(),
    OR: watches.map((w) => ({
      category: w.category as Prisma.EnumProduceCategoryFilter,
      // A null province on the watch means "anywhere in Thailand"; a null
      // quantity floor means "any size, down to a single crate". Both are
      // encoded by simply omitting the filter.
      ...(w.provinceId ? { provinceId: w.provinceId } : {}),
      ...(w.minQuantityKg ? { availableQtyKg: { gte: w.minQuantityKg } } : {}),
    })),
  };
}

export type AlertMatch = ReturnType<typeof serializeLot> & {
  /** Ids of the watches this lot matched, so the UI can show why. */
  watchIds: string[];
};

/**
 * Lots matching any of the user's watches, soonest spoilage first.
 *
 * `distinct` collapses a lot that satisfies two watches into a single row. It
 * is applied in-memory by Prisma for Postgres, so the take has to be generous
 * enough to survive the duplicates or a lot can be dropped from a page it
 * genuinely belongs on.
 */
export async function getAlertMatches(
  userId: string,
  take = 40,
): Promise<AlertMatch[]> {
  const watches = await prisma.brokerWatch.findMany({
    where: { userId },
    select: { id: true, category: true, provinceId: true, minQuantityKg: true },
  });

  const where = buildAlertWhere(watches);
  if (!where) return [];

  const rows = await prisma.lot.findMany({
    where,
    // Soonest to spoil first: the whole point is "act now", and ordering by
    // price or recency would bury the lots with an hour left.
    orderBy: { expiresAt: "asc" },
    take: take * 2,
    select: lotSelect,
  });

  // Re-check each returned lot against the watches in memory. Prisma's OR
  // already guarantees a match, so this is only here to recover which watches
  // were responsible — it lets the alert card say "matches 2 of your watches"
  // instead of leaving the user guessing why it appeared.
  const matched = rows.map((row) => ({
    ...serializeLot(row),
    watchIds: watches
      .filter(
        (w) =>
          w.category === row.category &&
          (w.provinceId === null || w.provinceId === row.provinceId) &&
          (w.minQuantityKg === null ||
            row.availableQtyKg >= w.minQuantityKg),
      )
      .map((w) => w.id),
  }));

  return matched.slice(0, take);
}

/**
 * Number of lots currently matching the user's watches, for the header badge.
 *
 * Returns 0 for a user with no watches without touching the lots table, so
 * the badge is free on the overwhelmingly common path of "no watches set up
 * yet". Uses count() rather than fetching, since the header only needs the
 * number.
 */
export async function countAlertMatches(userId: string): Promise<number> {
  const watches = await prisma.brokerWatch.findMany({
    where: { userId },
    select: { category: true, provinceId: true, minQuantityKg: true },
  });

  const where = buildAlertWhere(watches);
  if (!where) return 0;

  return prisma.lot.count({ where });
}
