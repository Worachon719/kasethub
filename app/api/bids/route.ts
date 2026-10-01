import { NextRequest, NextResponse } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createBidSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/bids — place an offer on a lot.
 *
 * The bidder is the signed-in session user, never a body field. Buyers and
 * brokers bid; a farmer cannot bid on a lot, least of all their own.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("BUYER", "BROKER", "ADMIN");
    const body = createBidSchema.parse(await readJson(request));

    const lot = await prisma.lot.findUnique({
      where: { id: body.lotId },
      select: {
        id: true,
        status: true,
        minOrderKg: true,
        availableQtyKg: true,
        farmerId: true,
        askPricePerKg: true,
      },
    });

    if (!lot) return fail("Lot not found", 404);
    if (lot.status !== "ACTIVE") {
      return fail(`Lot is not open for bidding (status: ${lot.status})`, 409);
    }
    if (lot.farmerId === user.id) {
      return fail("You cannot bid on your own lot", 403);
    }
    if (body.quantityKg < lot.minOrderKg) {
      return fail(`Minimum order is ${lot.minOrderKg} kg`, 422);
    }
    if (body.quantityKg > lot.availableQtyKg) {
      return fail(`Only ${lot.availableQtyKg} kg available`, 422);
    }

    const bid = await prisma.bid.create({
      data: {
        lotId: body.lotId,
        bidderId: user.id,
        pricePerKg: body.pricePerKg,
        quantityKg: body.quantityKg,
        note: body.note,
      },
      include: {
        bidder: { select: { id: true, nameTh: true, verification: true } },
      },
    });

    return ok(bid, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** GET /api/bids — bid board, filterable by lot or bidder. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const lotId = params.get("lotId") ?? undefined;
    const bidderId = params.get("bidderId") ?? undefined;
    const status = params.get("status") as
      | "PENDING"
      | "ACCEPTED"
      | "REJECTED"
      | "WITHDRAWN"
      | "EXPIRED"
      | null;

    const take = Math.min(Number(params.get("perPage") ?? 50) || 50, 100);

    const bids = await prisma.bid.findMany({
      where: {
        ...(lotId ? { lotId } : {}),
        ...(bidderId ? { bidderId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ pricePerKg: "desc" }, { createdAt: "desc" }],
      take,
      include: {
        bidder: { select: { id: true, nameTh: true, verification: true } },
        lot: {
          select: { id: true, lotCode: true, titleTh: true, titleEn: true },
        },
      },
    });

    return NextResponse.json(
      { data: bids, meta: { count: bids.length } },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
