import { prisma } from "@/lib/prisma";
import { lotSelect, serializeLot, type LotListItem } from "@/lib/lots";
import { categoryLabel } from "@/lib/categories";
import { spoilageLevel, daysUntil } from "@/lib/utils";

/**
 * Fetch the most urgent surplus lots for the homepage rail.
 * Degrades to an empty list when the database is not configured yet, so the
 * marketing page still renders on a fresh clone.
 */
export async function getUrgentLots(take = 8): Promise<LotListItem[]> {
  if (!process.env.DATABASE_URL) return [];

  const rows = await prisma.lot.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { not: null, lt: new Date(Date.now() + 5 * 86_400_000) },
    },
    orderBy: { expiresAt: "asc" },
    take,
    select: lotSelect,
  });

  return rows.map(serializeLot);
}

/** Latest market price rows for the persistent ticker. */
export async function getTickerQuotes(limit = 8) {
  if (!process.env.DATABASE_URL) return [];

  const latest = await prisma.marketPrice.findMany({
    orderBy: { recordedAt: "desc" },
    distinct: ["category", "variety"],
    take: limit,
    select: { id: true, variety: true, category: true, pricePerKg: true, changePct: true },
  });

  return latest.map((row) => ({
    id: row.id,
    // Prefer the specific variety; fall back to the Thai category label. This
    // used to strip underscores off the enum name, which put "FRESH FRUIT" in
    // the middle of an otherwise Thai ticker bar.
    label: row.variety ?? categoryLabel(row.category),
    pricePerKg: row.pricePerKg,
    changePct: row.changePct,
  }));
}

/** Marketplace aggregates shown on the homepage. */
export async function getMarketStats() {
  const empty = {
    activeLots: 0,
    surplusLots: 0,
    rescueValueThb: 0,
    provincesCovered: 0,
  };
  if (!process.env.DATABASE_URL) return empty;

  const [activeLots, surplusLots, agg, provinceGroups] =
    await prisma.$transaction([
      prisma.lot.count({ where: { status: "ACTIVE" } }),
      prisma.lot.count({ where: { status: "ACTIVE", isSurplus: true } }),
      prisma.lot.aggregate({
        where: { status: "ACTIVE", isSurplus: true },
        _sum: { askPricePerKg: true, availableQtyKg: true },
      }),
      // distinct provinces with live inventory, via a count-per-group rollup.
      prisma.lot.groupBy({
        by: ["provinceId"],
        where: { status: "ACTIVE", provinceId: { not: null } },
        _count: { _all: true },
        orderBy: { provinceId: "asc" },
      }),
    ]);

  return {
    activeLots,
    surplusLots,
    rescueValueThb: Math.round(
      (agg._sum.askPricePerKg ?? 0) * (agg._sum.availableQtyKg ?? 0),
    ),
    provincesCovered: provinceGroups.length,
  };
}

/** Split lots by spoilage tier, used for the urgency rail headings. */
export function groupByUrgency(lots: LotListItem[]) {
  return {
    critical: lots.filter((l) => spoilageLevel(l.expiresAt) === "critical"),
    moderate: lots.filter((l) => spoilageLevel(l.expiresAt) === "moderate"),
    optimal: lots.filter((l) => spoilageLevel(l.expiresAt) === "optimal"),
    days: (l: LotListItem) => (l.expiresAt ? daysUntil(l.expiresAt) : null),
  };
}
