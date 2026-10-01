import type { Prisma } from "@prisma/client";

/** Shape returned by GET /api/lots. */
export type LotListItem = {
  id: string;
  lotCode: string;
  titleTh: string;
  titleEn: string;
  category: string;
  grade: string;
  variety: string | null;
  askPricePerKg: number;
  quantityKg: number;
  availableQtyKg: number;
  minOrderKg: number;
  isSurplus: boolean;
  organic: boolean;
  gapCertified: boolean;
  coldChain: string;
  expiresAt: string | null;
  auctionEndsAt: string | null;
  imageUrl: string | null;
  provinceNameTh: string | null;
  region: string | null;
  farmerName: string | null;
  farmerVerification: string | null;
  farmerRatingAvg: number | null;
  /**
   * The grower's storefront, when they have one. Both are null together: a
   * grower who has not set a shop name has no /shop page, and linking to it
   * anyway would 404. Carried here so the card can decide whether to render
   * the link without a second query.
   */
  farmerId: string | null;
  farmerShopName: string | null;
  bidCount: number;
};

/**
 * Standard include for a single-lot response.
 *
 * The farmer relation is an explicit `select` rather than `farmer: true` on
 * purpose. `farmer: true` returns every column on User — `passwordHash`,
 * `phone`, `email`, `whatsapp` — and this shape is serialised straight into an
 * HTTP response body by POST /api/lots. Naming the fields is the only thing
 * that makes the omission reviewable: a future column added to User is not
 * automatically published.
 *
 * All images, not just the cover, because a lot may now carry five and the
 * detail view has a gallery.
 */
export const lotInclude = {
  images: { orderBy: { sortOrder: "asc" } },
  province: true,
  farmer: {
    select: {
      id: true,
      nameTh: true,
      nameEn: true,
      avatarUrl: true,
      verification: true,
      ratingAvg: true,
      ratingCount: true,
      dealCount: true,
      shopName: true,
      lineId: true,
    },
  },
  _count: { select: { bids: true } },
} satisfies Prisma.LotInclude;

export const lotSelect = {
  id: true,
  lotCode: true,
  titleTh: true,
  titleEn: true,
  category: true,
  grade: true,
  variety: true,
  askPricePerKg: true,
  quantityKg: true,
  availableQtyKg: true,
  minOrderKg: true,
  isSurplus: true,
  organic: true,
  gapCertified: true,
  coldChain: true,
  expiresAt: true,
  auctionEndsAt: true,
  // The FK itself, not just the joined name: /alerts has to tell whether a
  // watch narrowed to one province matched, and the joined name is not a
  // reliable key for that comparison.
  provinceId: true,
  province: { select: { nameTh: true, region: true } },
  farmerId: true,
  farmer: {
    // shopName is here solely to decide whether /shop/<id> exists; the
    // storefront page itself is the only thing that shows the description.
    select: {
      nameTh: true,
      nameEn: true,
      verification: true,
      ratingAvg: true,
      shopName: true,
    },
  },
  images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
  _count: { select: { bids: true } },
} satisfies Prisma.LotSelect;

type LotRow = Prisma.LotGetPayload<{ select: typeof lotSelect }>;

/** Flatten a raw Lot row into the JSON shape the frontend consumes. */
export function serializeLot(row: LotRow): LotListItem {
  return {
    id: row.id,
    lotCode: row.lotCode,
    titleTh: row.titleTh,
    titleEn: row.titleEn,
    category: row.category,
    grade: row.grade,
    variety: row.variety,
    askPricePerKg: row.askPricePerKg,
    quantityKg: row.quantityKg,
    availableQtyKg: row.availableQtyKg,
    minOrderKg: row.minOrderKg,
    isSurplus: row.isSurplus,
    organic: row.organic,
    gapCertified: row.gapCertified,
    coldChain: row.coldChain,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    auctionEndsAt: row.auctionEndsAt?.toISOString() ?? null,
    imageUrl: row.images[0]?.url ?? null,
    provinceNameTh: row.province?.nameTh ?? null,
    region: row.province?.region ?? null,
    farmerName: row.farmer?.nameTh ?? row.farmer?.nameEn ?? null,
    farmerVerification: row.farmer?.verification ?? null,
    farmerRatingAvg: row.farmer?.ratingAvg ?? null,
    farmerId: row.farmerId,
    // Null unless a storefront actually exists.
    farmerShopName: row.farmer?.shopName ?? null,
    bidCount: row._count.bids,
  };
}
