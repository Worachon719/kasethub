import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { buildLotOrderBy, buildLotWhere } from "@/lib/lot-query";
import { lotInclude, lotSelect, serializeLot } from "@/lib/lots";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/session";
import { storeLotImages } from "@/lib/storage";
import { createLotSchema, lotQuerySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/lots — search, filter, sort, and paginate the marketplace.
 *
 * Query params: q, category, province, region, status, minPrice, maxPrice,
 * minQty, surplusOnly, organic, urgency, sort, page, perPage
 */
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = lotQuerySchema.parse(params);

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

    const totalPages = Math.max(1, Math.ceil(total / query.perPage));

    return NextResponse.json(
      {
        data: rows.map(serializeLot),
        meta: { total, page: query.page, perPage: query.perPage, totalPages },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/lots — publish a new lot.
 *
 * The farmer is the signed-in session user, never a body field. Brokers and
 * buyers cannot post supply, so the role check is the guard.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("FARMER", "ADMIN");
    const body = createLotSchema.parse(await readJson(request));

    if (body.minOrderKg > body.quantityKg) {
      return fail("minOrderKg cannot exceed quantityKg", 422);
    }

    if (
      body.expiresAt &&
      body.harvestDate &&
      body.expiresAt <= body.harvestDate
    ) {
      return fail("expiresAt must be after harvestDate", 422);
    }

    /**
     * The province must resolve to a row in the Province table, which holds
     * Thai provinces only. This is what actually enforces "จัดส่งเฉพาะภายใน
     * ประเทศไทย" on the write path — a Zod `min(1)` only proves the field is
     * non-empty, so a hand-rolled client could still post a foreign id and the
     * lot would carry a location the platform cannot ship within.
     */
    const province = await prisma.province.findUnique({
      where: { id: body.provinceId },
      select: { id: true, nameTh: true, code: true },
    });
    if (!province) {
      return fail(
        "จังหวัดไม่ถูกต้อง — KasetHub ให้บริการจัดส่งเฉพาะภายในประเทศไทย",
        422,
      );
    }

    const lotCode = await generateLotCode();

    /**
     * Photos are uploaded before the lot row is written, so `images[0]` is a
     * real hosted URL by the time the insert happens and the cover is never a
     * dangling data URL. A storage failure aborts the whole create — a lot with
     * no photo is still a valid listing, so falling back to zero images would
     * be defensible, but silently dropping a photo the farmer can see in their
     * preview is worse than telling them the upload failed.
     */
    const uploaded = await storeLotImages(body.images, user.id);
    if (!uploaded.ok) {
      const suffix =
        uploaded.index > 0 ? ` (รูปที่ ${uploaded.index + 1} จาก ${body.images.length})` : "";
      return fail(`${uploaded.message}${suffix}`, uploaded.status);
    }

    const lot = await prisma.lot.create({
      data: {
        lotCode,
        titleTh: body.titleTh,
        titleEn: body.titleEn,
        category: body.category,
        grade: body.grade,
        variety: body.variety,
        askPricePerKg: body.askPricePerKg,
        quantityKg: body.quantityKg,
        availableQtyKg: body.quantityKg,
        minOrderKg: body.minOrderKg,
        provinceId: body.provinceId,
        district: body.district,
        latitude: body.latitude,
        longitude: body.longitude,
        coldChain: body.coldChain,
        organic: body.organic,
        gapCertified: body.gapCertified,
        isSurplus: body.isSurplus,
        harvestDate: body.harvestDate,
        expiresAt: body.expiresAt,
        auctionEndsAt: body.auctionEndsAt,
        farmerId: user.id,
        // sortOrder is the cover ranking, and LotImage has no createdAt ordering
        // guarantee the readers can rely on — every consumer sorts by it.
        images: {
          create: uploaded.urls.map((url, i) => ({
            url,
            altTh: `${body.titleTh} (รูปที่ ${i + 1})`,
            sortOrder: i,
          })),
        },
        priceLogs: {
          create: { pricePerKg: body.askPricePerKg, source: "ASK" },
        },
      },
      include: lotInclude,
    });

    // lotInclude (not lotSelect) so the response carries farmer + image details.
    return ok(lot, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** DELETE /api/lots?id=… — withdraw a listing. Owner or admin only. */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return fail("id query param is required", 422);

    const existing = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, farmerId: true, status: true },
    });

    if (!existing) return fail("Lot not found", 404);
    if (existing.farmerId !== user.id && user.role !== "ADMIN") {
      return fail("You can only withdraw your own listing", 403);
    }

    const lot = await prisma.lot.update({
      where: { id },
      data: { status: "WITHDRAWN" },
      select: { id: true, lotCode: true, status: true },
    });

    return ok(lot);
  } catch (error) {
    return handleRouteError(error);
  }
}

type Tx = Prisma.TransactionClient;

/** Sequential lot code: KH-YYMMDD-XXXX, retried on the (unlikely) collision. */
async function generateLotCode(tx?: Tx): Promise<string> {
  const now = new Date();
  const stamp = [
    now.getFullYear().toString().slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const client = tx ?? prisma;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `KH-${stamp}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;
    const clash = await client.lot.findUnique({
      where: { lotCode: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  return `KH-${stamp}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}
