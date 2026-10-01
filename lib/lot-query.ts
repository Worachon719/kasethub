import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LotQuery, Urgency } from "@/lib/validations";

const DAY_MS = 86_400_000;

/** Inclusive [from, to) window in days-from-now for each urgency bucket. */
const URGENCY_WINDOWS: Record<Urgency, { from: number; to: number }> = {
  critical: { from: -Infinity, to: 1 },
  urgent: { from: 1, to: 2 },
  moderate: { from: 2, to: 5 },
  normal: { from: 5, to: Infinity },
};

/**
 * Turn a day offset into a Date, or omit the bound entirely when the offset is
 * unbounded.
 *
 * `new Date(NaN)` is what `now + (-Infinity * DAY_MS)` produces, and Prisma
 * rejects an invalid Date client-side with P2025 before a query is sent — a 500
 * from a healthy database. `critical` starts at -Infinity and `normal` ends at
 * +Infinity, so both open-ended buckets have to drop the bound rather than
 * translate it, otherwise the two most-clicked facets on /market 500.
 */
function bound(daysFromNow: number): Date | undefined {
  if (!Number.isFinite(daysFromNow)) return undefined;
  const date = new Date(Date.now() + daysFromNow * DAY_MS);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function urgencyWindow(u: Urgency): Prisma.DateTimeFilter {
  const { from, to } = URGENCY_WINDOWS[u];
  const after = bound(from);
  const until = bound(to);
  return {
    ...(after ? { gt: after } : {}),
    ...(until ? { lte: until } : {}),
  };
}

/**
 * Translate the flat lot query string into a Prisma `where` clause.
 *
 * Lives in /lib rather than the route file so server components can reuse it
 * without importing a route module.
 */
export function buildLotWhere(q: LotQuery): Prisma.LotWhereInput {
  const where: Prisma.LotWhereInput = { status: q.status };

  const and: Prisma.LotWhereInput[] = [];

  if (q.q) {
    and.push({
      OR: [
        { titleTh: { contains: q.q, mode: "insensitive" } },
        { titleEn: { contains: q.q, mode: "insensitive" } },
        { variety: { contains: q.q, mode: "insensitive" } },
        { lotCode: { contains: q.q, mode: "insensitive" } },
      ],
    });
  }

  if (q.category) where.category = q.category;
  if (q.surplusOnly) where.isSurplus = true;
  if (q.organic) where.organic = true;

  // province and region both target the same relation, so merge them.
  const provinceFilter: Prisma.ProvinceWhereInput = {};
  if (q.province) provinceFilter.nameTh = { contains: q.province };
  if (q.region) provinceFilter.region = q.region;
  if (Object.keys(provinceFilter).length) where.province = provinceFilter;

  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    where.askPricePerKg = {
      ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
      ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
    };
  }

  if (q.minQty !== undefined) {
    where.availableQtyKg = { gte: q.minQty };
  }

  if (q.urgency) {
    // An urgency facet only makes sense for lots that carry a sell-by date.
    where.expiresAt = urgencyWindow(q.urgency);
  } else {
    // Otherwise hide lots whose sell-by date has already passed.
    and.push({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });
  }

  if (and.length) where.AND = and;
  return where;
}

export function buildLotOrderBy(
  sort: LotQuery["sort"],
): Prisma.LotOrderByWithRelationInput[] {
  switch (sort) {
    case "expiring":
      return [{ expiresAt: "asc" }, { createdAt: "desc" }];
    case "price_desc":
      return [{ askPricePerKg: "desc" }];
    case "price_asc":
      return [{ askPricePerKg: "asc" }];
    case "volume":
      return [{ availableQtyKg: "desc" }];
    case "rating":
      return [{ farmer: { ratingAvg: "desc" } }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

/**
 * Facet counts for the marketplace filter rail.
 *
 * Each dimension is counted with that dimension's own filter removed, so a
 * facet always shows what selecting a *sibling* value would yield rather than
 * collapsing to the current selection. That is the whole point of a count
 * beside a filter: it tells you whether picking it is worth anything.
 */
export async function getLotFacets(query: LotQuery) {
  if (!process.env.DATABASE_URL) {
    return {
      total: 0,
      criticalCount: 0,
      rescueValueThb: 0,
      urgency: { critical: 0, urgent: 0, moderate: 0, normal: 0 } as Record<
        Urgency,
        number
      >,
      category: {} as Record<string, number>,
      region: {} as Record<string, number>,
    };
  }

  const withoutUrgency = buildLotWhere({ ...query, urgency: undefined });
  const withoutCategory = buildLotWhere({ ...query, category: undefined });
  const withoutRegion = buildLotWhere({
    ...query,
    region: undefined,
    province: undefined,
  });

  // Surplus-only scope drives the "วิกฤต" rail, independent of the current
  // search, so it always answers "how much stock is about to spoil".
  const surplusWhere: Prisma.LotWhereInput = {
    status: "ACTIVE",
    isSurplus: true,
  };

  // Value at risk is SUM(price x quantity) per lot, not the product of the two
  // column sums — those differ as soon as lots are priced differently, which
  // they always are. Prisma's aggregate cannot express a product across rows, so
  // this is the one aggregate written as SQL.
  const [total, criticalRows, categoryRows, provinceRows, provinces, rescue] =
    await Promise.all([
      prisma.lot.count({ where: withoutUrgency }),
      prisma.lot.findMany({
        where: { ...surplusWhere, expiresAt: { not: null } },
        select: { expiresAt: true },
      }),
      prisma.lot.groupBy({
        by: ["category"],
        where: withoutCategory,
        _count: { _all: true },
      }),
      prisma.lot.groupBy({
        by: ["provinceId"],
        where: withoutRegion,
        _count: { _all: true },
      }),
      prisma.province.findMany({ select: { id: true, region: true } }),
      prisma.$queryRaw<{ value: number | null }[]>`
        SELECT COALESCE(SUM(ask_price_per_kg * available_qty_kg), 0) AS value
        FROM lots
        WHERE status = 'ACTIVE'::"LotStatus" AND is_surplus = true
      `,
    ]);

  const urgencyCounts: Record<Urgency, number> = {
    critical: 0,
    urgent: 0,
    moderate: 0,
    normal: 0,
  };
  const now = Date.now();
  let criticalCount = 0;
  for (const row of criticalRows) {
    if (!row.expiresAt) continue;
    const days = (row.expiresAt.getTime() - now) / DAY_MS;
    if (days < 1) {
      urgencyCounts.critical++;
      criticalCount++;
    } else if (days < 2) urgencyCounts.urgent++;
    else if (days <= 5) urgencyCounts.moderate++;
    else urgencyCounts.normal++;
  }

  // Lots roll up from province to region; the schema stores region on Province.
  const regionByProvince = new Map(provinces.map((p) => [p.id, p.region]));
  const regionCounts: Record<string, number> = {};
  for (const row of provinceRows) {
    const region = row.provinceId ? regionByProvince.get(row.provinceId) : null;
    const key = region ?? "UNKNOWN";
    regionCounts[key] = (regionCounts[key] ?? 0) + row._count._all;
  }

  return {
    total,
    criticalCount,
    rescueValueThb: Math.round(Number(rescue[0]?.value ?? 0)),
    urgency: urgencyCounts,
    category: Object.fromEntries(
      categoryRows.map((r) => [r.category, r._count._all]),
    ) as Record<string, number>,
    region: regionCounts,
  };
}
