import { NextRequest } from "next/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import {
  getMessages,
  isParticipant,
  resolveThread,
  threadCapability,
} from "@/lib/deal";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/deals/:id — negotiation context for a bid or an order.
 *
 * `id` is a Bid id or an Order id; `resolveThread` figures out which. Private
 * to the two participants, so an unrelated caller gets 404 rather than 403 and
 * cannot probe for the existence of a deal.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const thread = await resolveThread(id);

    if (!thread || !isParticipant(thread, user.id)) {
      return fail("Deal not found", 404);
    }

    const messages = await getMessages(thread);

    return ok({
      ...thread,
      viewer: {
        ...threadCapability(thread, user.id),
        role: user.role,
      },
      messages: messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
