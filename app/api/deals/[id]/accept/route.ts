import { NextRequest } from "next/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import { isParticipant, resolveThread } from "@/lib/deal";
import { acceptBid } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/deals/:id/accept — close the deal at the current terms.
 *
 * The farmer only. Delegates to acceptBid so the accept path is identical
 * whether it is reached from the deal room or from the bid board, then posts a
 * SYSTEM message announcing the locked price.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const thread = await resolveThread(id);

    if (!thread || !isParticipant(thread, user.id)) {
      return fail("Deal not found", 404);
    }
    if (thread.kind !== "BID") {
      return fail("This deal is already closed", 409);
    }
    if (thread.farmer.id !== user.id) {
      return fail("Only the farmer can accept an offer", 403);
    }

    const result = await acceptBid(thread.threadId);
    if (!result.ok) return fail(result.message, result.status);

    return ok(
      {
        orderId: result.order.id,
        orderCode: result.order.orderCode,
        message: "ดีลสำเร็จ — ล็อคเงิน Escrow แล้ว",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
