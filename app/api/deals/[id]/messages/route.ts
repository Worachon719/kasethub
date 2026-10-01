import { NextRequest } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { getMessages, isParticipant, resolveThread } from "@/lib/deal";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { storeImage } from "@/lib/storage";
import { sendMessageSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/deals/:id/messages — the thread transcript, oldest first.
 *
 * Cheap enough to poll: the deal page refetches on an interval so both sides
 * see new offers and photos without a socket layer.
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

    return ok(
      messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/deals/:id/messages — send text, an image, or both.
 *
 * `imageDataUrl` carries a browser-compressed data URL. It is persisted via
 * lib/storage and the resulting URL is what lands on the row, so messages
 * posted under the inline fallback can be migrated to storage later without
 * rewriting the transcript.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const thread = await resolveThread(id);

    if (!thread || !isParticipant(thread, user.id)) {
      return fail("Deal not found", 404);
    }

    const raw = (await readJson(request)) as Record<string, unknown>;
    const body = sendMessageSchema.parse({
      body: raw.body,
      imageUrl: raw.imageUrl,
      imageAlt: raw.imageAlt,
      imageDataUrl: raw.imageDataUrl,
    });

    let imageUrl = body.imageUrl ?? null;

    if (body.imageDataUrl) {
      const stored = await storeImage(body.imageDataUrl, user.id);
      if (!stored.ok) return fail(stored.message, stored.status);
      imageUrl = stored.url;
    }

    const message = await prisma.chatMessage.create({
      data: {
        // Only one of the two may be set, matching the thread this id resolved to.
        ...(thread.kind === "ORDER"
          ? { orderId: thread.threadId }
          : { bidId: thread.threadId }),
        senderId: user.id,
        body: body.body,
        imageUrl,
        imageAlt: body.imageAlt,
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
        sender: {
          select: {
            id: true,
            nameTh: true,
            nameEn: true,
            role: true,
            verification: true,
            avatarUrl: true,
          },
        },
      },
    });

    return ok({ ...message, createdAt: message.createdAt.toISOString() }, {
      status: 201,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
