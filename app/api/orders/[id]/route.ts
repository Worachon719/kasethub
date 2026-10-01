import { NextRequest } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import {
  ESCROW_PROGRESSION,
  isEscrowStatus,
} from "@/lib/deal";
import { prisma } from "@/lib/prisma";
import { TRANSACTION_OPTIONS } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { updateOrderSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Milestones in the order they must be reached. */
const PROGRESSION = ESCROW_PROGRESSION;

const isProgression = isEscrowStatus;

/**
 * GET /api/orders/:id — escrow timeline and deal chat.
 *
 * Restricted to the two parties. A missing order and an order the caller has
 * no business seeing both return 404 so the endpoint cannot be used to probe
 * for order ids.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, nameTh: true, role: true } } },
        },
        lot: {
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            province: { select: { nameTh: true, nameEn: true } },
          },
        },
        buyer: { select: { id: true, nameTh: true, role: true, verification: true } },
        seller: { select: { id: true, nameTh: true, role: true, verification: true } },
      },
    });

    if (!order) return fail("Order not found", 404);

    const isParty = order.buyerId === user.id || order.sellerId === user.id;
    if (!isParty && user.role !== "ADMIN") {
      return fail("Order not found", 404);
    }

    return ok({
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      closedAt: order.closedAt?.toISOString() ?? null,
      events: order.events.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      messages: order.messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PATCH /api/orders/:id — advance the escrow milestone.
 *
 * Milestones only move forward one step at a time, because each one releases
 * or re-holds money and the escrow trail is the audit record. DISPUTED and
 * CANCELLED are reachable from any open state.
 *
 * Advancing to COMPLETED marks the lot SOLD; cancelling returns it to ACTIVE.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = updateOrderSchema.parse(await readJson(request));

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, lotId: true, buyerId: true, sellerId: true, status: true },
    });

    if (!existing) return fail("Order not found", 404);

    const isParty = existing.buyerId === user.id || existing.sellerId === user.id;
    if (!isParty && user.role !== "ADMIN") {
      return fail("Order not found", 404);
    }

    const current = existing.status;
    const isTerminal = current === "COMPLETED" || current === "CANCELLED";

    if (isTerminal) {
      return fail(`Order is already ${current}`, 409);
    }

    if (body.status === "DISPUTED" || body.status === "CANCELLED") {
      // Allowed from any open state.
    } else if (isProgression(body.status) && isProgression(current)) {
      const expected = PROGRESSION[PROGRESSION.indexOf(current) + 1];
      if (body.status !== expected) {
        return fail(
          `Cannot move from ${current} to ${body.status}`,
          409,
          { expected },
        );
      }
    } else {
      return fail("Invalid order status", 422, { allowed: PROGRESSION });
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: body.status,
          closedAt:
            body.status === "COMPLETED" || body.status === "CANCELLED"
              ? new Date()
              : undefined,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          status: body.status,
          note: body.note,
          actorId: user.id,
        },
      });

      if (body.status === "COMPLETED") {
        await tx.lot.update({
          where: { id: updated.lotId },
          data: { status: "SOLD" },
        });
      }

      if (body.status === "CANCELLED") {
        await tx.lot.update({
          where: { id: updated.lotId },
          data: { status: "ACTIVE" },
        });
      }

      return updated;
    }, TRANSACTION_OPTIONS);

    return ok(order);
  } catch (error) {
    return handleRouteError(error);
  }
}
