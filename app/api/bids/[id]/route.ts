import { NextRequest } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { acceptBid } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { resolveBidSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/bids/:id — accept or reject a bid.
 *
 * Only the lot's own farmer (or an admin) may resolve a bid; a bidder has no
 * say in their own outcome. Accepting runs the escrow transaction in
 * lib/orders, shared with POST /api/deals/:id/accept.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { status } = resolveBidSchema.parse(await readJson(request));

    const bid = await prisma.bid.findUnique({
      where: { id },
      select: {
        id: true,
        bidderId: true,
        status: true,
        lot: { select: { id: true, farmerId: true } },
      },
    });

    if (!bid) return fail("Bid not found", 404);

    const isOwner = bid.lot.farmerId === user.id;
    if (!isOwner && user.role !== "ADMIN") {
      return fail("Only the lot owner can resolve this bid", 403);
    }

    if (status === "REJECTED") {
      const updated = await prisma.bid.update({
        where: { id: bid.id },
        data: { status: "REJECTED" },
      });
      return ok(updated);
    }

    const result = await acceptBid(bid.id);
    if (!result.ok) return fail(result.message, result.status);

    // acceptBid already returns the created order, so the accepted bid does not
    // need a second round trip to fetch what it just wrote.
    return ok(
      {
        bidId: result.bidId,
        order: result.order,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/** DELETE /api/bids/:id — the bidder withdraws their own offer. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const bid = await prisma.bid.findUnique({
      where: { id },
      select: { id: true, bidderId: true, status: true },
    });

    if (!bid) return fail("Bid not found", 404);
    if (bid.bidderId !== user.id && user.role !== "ADMIN") {
      return fail("You can only withdraw your own offer", 403);
    }
    if (bid.status !== "PENDING") {
      return fail(`Bid already ${bid.status}`, 409);
    }

    const updated = await prisma.bid.update({
      where: { id: bid.id },
      data: { status: "WITHDRAWN" },
    });
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
