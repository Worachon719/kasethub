import { NextRequest } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { isParticipant, resolveThread, threadCapability } from "@/lib/deal";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TRANSACTION_OPTIONS } from "@/lib/orders";
import { counterOfferSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/deals/:id/counter-offer — post revised terms into the thread.
 *
 * A counter-offer is a real Bid row (so the bid board and the farmer dashboard
 * stay truthful) plus an OFFER-kind message that renders as a card. The
 * previous bid is left PENDING rather than superseded, because the schema has
 * no "superseded" status; the new row simply sorts higher.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const thread = await resolveThread(id);

    if (!thread || !isParticipant(thread, user.id)) {
      return fail("Deal not found", 404);
    }

    if (thread.kind !== "BID") {
      return fail(
        "Terms are locked once escrow is funded. Use the order milestones instead.",
        409,
      );
    }

    const capability = threadCapability(thread, user.id);
    if (!capability.canCounterOffer) {
      return fail("Only the buyer can counter-offer on this thread", 403);
    }

    const body = counterOfferSchema.parse(await readJson(request));

    if (body.quantityKg < thread.lot.minOrderKg) {
      return fail(`Minimum order is ${thread.lot.minOrderKg} kg`, 422);
    }
    if (body.quantityKg > thread.lot.availableQtyKg) {
      return fail(`Only ${thread.lot.availableQtyKg} kg available`, 422);
    }

    const totalThb = Math.round(body.pricePerKg * body.quantityKg);

    const { bid, message } = await prisma.$transaction(async (tx) => {
      const created = await tx.bid.create({
        data: {
          lotId: thread.lot.id,
          bidderId: user.id,
          pricePerKg: body.pricePerKg,
          quantityKg: body.quantityKg,
          note: body.body,
          status: "PENDING",
        },
        select: { id: true, pricePerKg: true, quantityKg: true, status: true },
      });

      // Post on the originating thread so the negotiation history reads in
      // order, and record the new bid id for the UI to jump to.
      const posted = await tx.chatMessage.create({
        data: {
          bidId: thread.threadId,
          senderId: user.id,
          body: body.body ?? "ยื่นข้อเสนอราคาใหม่",
          kind: "OFFER",
          offerPricePerKg: body.pricePerKg,
          offerQuantityKg: body.quantityKg,
        },
        select: {
          id: true,
          bidId: true,
          orderId: true,
          senderId: true,
          body: true,
          imageUrl: true,
          imageAlt: true,
          kind: true,
          offerPricePerKg: true,
          offerQuantityKg: true,
          createdAt: true,
        },
      });

      return { bid: created, message: posted };
    }, TRANSACTION_OPTIONS);

    return ok(
      {
        bid,
        message: { ...message, createdAt: message.createdAt.toISOString() },
        totalThb,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
