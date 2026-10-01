import { NextRequest } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET /api/lots/:id — full lot detail including image set and bid history. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const lot = await prisma.lot.findUnique({
      where: { id },
      include: {
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
            phone: true,
            lineId: true,
            whatsapp: true,
          },
        },
        supplier: true,
        _count: { select: { bids: true, orders: true } },
        bids: {
          where: { status: "PENDING" },
          orderBy: { pricePerKg: "desc" },
          take: 10,
          include: {
            bidder: { select: { id: true, nameTh: true, verification: true } },
          },
        },
      },
    });

    if (!lot) return fail("Lot not found", 404);

    return ok({
      ...lot,
      expiresAt: lot.expiresAt?.toISOString() ?? null,
      harvestDate: lot.harvestDate?.toISOString() ?? null,
      auctionEndsAt: lot.auctionEndsAt?.toISOString() ?? null,
      createdAt: lot.createdAt.toISOString(),
      updatedAt: lot.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** PATCH /api/lots/:id — adjust price, quantity, or lifecycle status. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await readJson(request)) as Record<string, unknown>;

    const data: Record<string, unknown> = {};

    if (typeof body.askPricePerKg === "number" && body.askPricePerKg > 0) {
      data.askPricePerKg = body.askPricePerKg;
    }
    if (typeof body.status === "string") {
      data.status = body.status;
    }
    if (typeof body.isSurplus === "boolean") {
      data.isSurplus = body.isSurplus;
    }
    if (typeof body.expiresAt === "string" || body.expiresAt === null) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (typeof body.auctionEndsAt === "string" || body.auctionEndsAt === null) {
      data.auctionEndsAt = body.auctionEndsAt
        ? new Date(body.auctionEndsAt)
        : null;
    }
    if (typeof body.quantityKg === "number" && body.quantityKg >= 0) {
      data.quantityKg = Math.floor(body.quantityKg);
      data.availableQtyKg = Math.floor(body.quantityKg);
    }

    if (Object.keys(data).length === 0) {
      return fail("No updatable fields supplied", 422);
    }

    const lot = await prisma.lot.update({
      where: { id },
      data,
      include: {
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
            phone: true,
            lineId: true,
            whatsapp: true,
          },
        },
        supplier: true,
        _count: { select: { bids: true, orders: true } },
        bids: {
          where: { status: "PENDING" },
          orderBy: { pricePerKg: "desc" },
          take: 10,
          include: {
            bidder: { select: { id: true, nameTh: true, verification: true } },
          },
        },
      },
    });

    return ok(lot);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** DELETE /api/lots/:id — withdraw a listing. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.lot.update({
      where: { id },
      data: { status: "WITHDRAWN" },
    });
    return ok({ id, status: "WITHDRAWN" });
  } catch (error) {
    return handleRouteError(error);
  }
}
