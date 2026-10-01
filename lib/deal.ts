import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Negotiation threads hang off a Bid (before a deal closes) or an Order
 * (after escrow is funded). A single identifier is used in URLs, so
 * `resolveThread` accepts either and reports which one it found.
 */
export type ThreadKind = "BID" | "ORDER";

export type ThreadParticipant = {
  id: string;
  name: string;
  role: string;
  verification: string;
  avatarUrl: string | null;
};

export type DealThread = {
  kind: ThreadKind;
  threadId: string;
  lot: {
    id: string;
    lotCode: string;
    titleTh: string;
    titleEn: string;
    variety: string | null;
    grade: string;
    category: string;
    coldChain: string;
    organic: boolean;
    gapCertified: boolean;
    isSurplus: boolean;
    imageUrl: string | null;
    availableQtyKg: number;
    quantityKg: number;
    minOrderKg: number;
    askPricePerKg: number;
    district: string | null;
    province: string | null;
    expiresAt: string | null;
    auctionEndsAt: string | null;
  };
  /** The farmer selling the lot. Always a participant. */
  farmer: ThreadParticipant;
  /** The counterparty: the bidder on a bid thread, the buyer on an order. */
  counterparty: ThreadParticipant;
  /** Latest standing terms, whether from the bid or the order. */
  terms: {
    pricePerKg: number;
    quantityKg: number;
    totalThb: number;
    escrowThb: number;
    status: string;
    expiresAt: string | null;
    accepted: boolean;
  };
  /** Present on ORDER threads only — drives the escrow gauge. */
  orderStatus: string | null;
  orderCode: string | null;
};

const participantSelect = {
  id: true,
  nameTh: true,
  nameEn: true,
  role: true,
  verification: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

type ParticipantRow = Prisma.UserGetPayload<{ select: typeof participantSelect }>;

export function toParticipant(row: ParticipantRow): ThreadParticipant {
  return {
    id: row.id,
    name: row.nameTh ?? row.nameEn ?? "ผู้ใช้งาน",
    role: row.role,
    verification: row.verification,
    avatarUrl: row.avatarUrl,
  };
}

const lotSelect = {
  id: true,
  lotCode: true,
  titleTh: true,
  titleEn: true,
  variety: true,
  grade: true,
  category: true,
  coldChain: true,
  organic: true,
  gapCertified: true,
  isSurplus: true,
  availableQtyKg: true,
  quantityKg: true,
  minOrderKg: true,
  askPricePerKg: true,
  district: true,
  expiresAt: true,
  auctionEndsAt: true,
  images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
  province: { select: { nameTh: true } },
} satisfies Prisma.LotSelect;

type LotRow = Prisma.LotGetPayload<{ select: typeof lotSelect }>;

function toLot(row: LotRow): DealThread["lot"] {
  return {
    id: row.id,
    lotCode: row.lotCode,
    titleTh: row.titleTh,
    titleEn: row.titleEn,
    variety: row.variety,
    grade: row.grade,
    category: row.category,
    coldChain: row.coldChain,
    organic: row.organic,
    gapCertified: row.gapCertified,
    isSurplus: row.isSurplus,
    imageUrl: row.images[0]?.url ?? null,
    availableQtyKg: row.availableQtyKg,
    quantityKg: row.quantityKg,
    minOrderKg: row.minOrderKg,
    askPricePerKg: row.askPricePerKg,
    district: row.district,
    province: row.province?.nameTh ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    auctionEndsAt: row.auctionEndsAt?.toISOString() ?? null,
  };
}

/** Escrow is the full subtotal; the platform fee comes out of the payout. */
export function escrowFor(pricePerKg: number, quantityKg: number): number {
  return Math.round(pricePerKg * quantityKg);
}

export function platformFeeFor(subtotalThb: number): number {
  return Math.round(subtotalThb * 0.03);
}

/**
 * Load a negotiation thread by bid id or order id.
 *
 * Returns `{ thread, farmer, counterparty }` so callers can assert the viewer
 * is one of the two participants before reading or writing messages.
 */
export async function resolveThread(
  id: string,
): Promise<DealThread | null> {
  // Orders are checked first: a settled deal is the more interesting thread,
  // and cuid collision between the two tables is not a practical concern.
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderCode: true,
      status: true,
      buyerId: true,
      quantityKg: true,
      pricePerKg: true,
      buyer: { select: participantSelect },
      seller: { select: participantSelect },
      lot: { select: { ...lotSelect, farmer: { select: participantSelect } } },
    },
  });

  if (order?.seller) {
    return {
      kind: "ORDER",
      threadId: order.id,
      lot: toLot(order.lot),
      farmer: toParticipant(order.lot.farmer ?? order.seller),
      counterparty: toParticipant(order.buyer),
      terms: {
        pricePerKg: order.pricePerKg,
        quantityKg: order.quantityKg,
        totalThb: escrowFor(order.pricePerKg, order.quantityKg),
        escrowThb: escrowFor(order.pricePerKg, order.quantityKg),
        status: order.status,
        expiresAt: null,
        accepted: true,
      },
      orderStatus: order.status,
      orderCode: order.orderCode,
    };
  }

  const bid = await prisma.bid.findUnique({
    where: { id },
    select: {
      id: true,
      pricePerKg: true,
      quantityKg: true,
      status: true,
      expiresAt: true,
      bidder: { select: participantSelect },
      lot: { select: { ...lotSelect, farmer: { select: participantSelect } } },
    },
  });

  // A bid with no farmer is a system/seed artefact with no counterparty to
  // negotiate with, so there is nothing to render.
  if (!bid?.lot.farmer) return null;

  const subtotal = escrowFor(bid.pricePerKg, bid.quantityKg);

  return {
    kind: "BID",
    threadId: bid.id,
    lot: toLot(bid.lot),
    farmer: toParticipant(bid.lot.farmer),
    counterparty: toParticipant(bid.bidder),
    terms: {
      pricePerKg: bid.pricePerKg,
      quantityKg: bid.quantityKg,
      totalThb: subtotal,
      escrowThb: subtotal,
      status: bid.status,
      expiresAt: bid.expiresAt?.toISOString() ?? null,
      accepted: bid.status === "ACCEPTED",
    },
    orderStatus: null,
    orderCode: null,
  };
}

/** True when the viewer is the farmer or the counterparty on this thread. */
export function isParticipant(
  thread: DealThread,
  userId: string,
): boolean {
  return (
    thread.farmer.id === userId || thread.counterparty.id === userId
  );
}

/**
 * Only the farmer may accept or reject; the counterparty may walk away.
 *
 * Capabilities come from thread membership rather than role: a farmer who is
 * the seller of *this* lot can accept, and no other farmer can, so role is not
 * consulted here.
 */
export function threadCapability(
  thread: DealThread,
  userId: string,
): {
  isFarmer: boolean;
  isCounterparty: boolean;
  canAccept: boolean;
  canCounterOffer: boolean;
  canAdvanceEscrow: boolean;
  canSendMessage: boolean;
} {
  const isFarmer = thread.farmer.id === userId;
  const isCounterparty = thread.counterparty.id === userId;
  const participant = isFarmer || isCounterparty;

  return {
    isFarmer,
    isCounterparty,
    // Accepting creates the order and locks escrow, so it is the farmer's call.
    canAccept: isFarmer && thread.kind === "BID" && thread.terms.status === "PENDING",
    // A counter-offer is a new bid, which only the counterparty can place.
    canCounterOffer:
      participant &&
      thread.kind === "BID" &&
      thread.terms.status === "PENDING" &&
      !isFarmer,
    // Milestones are shared work — the farmer inspects and loads, the buyer
    // confirms delivery — so either party may move the order forward one step.
    // The API enforces the same rule; this only decides whether to draw the
    // button. `orderStatus` is null on BID threads, so the kind check is
    // belt-and-braces against a half-populated order.
    canAdvanceEscrow:
      participant &&
      thread.kind === "ORDER" &&
      thread.orderStatus !== null &&
      nextEscrowStep(thread.orderStatus) !== null,
    canSendMessage: participant,
  };
}

/**
 * Milestones in the order the API requires, mirroring PROGRESSION in
 * `app/api/orders/[id]/route.ts`.
 *
 * Exported rather than duplicated inline because both the route's validation
 * and the client's button label need the same list; a change to one that did
 * not reach the other would either 409 on a legal move or hide a legal move
 * behind no button at all.
 */
export const ESCROW_PROGRESSION = [
  "ESCROW_DEPOSITED",
  "QUALITY_INSPECTED",
  "LOADED_SHIPPED",
  "COMPLETED",
] as const;

export type EscrowStatus = (typeof ESCROW_PROGRESSION)[number];

/** The one legal next milestone, or null when the order is terminal. */
export function nextEscrowStep(
  status: string,
): EscrowStatus | null {
  const i = ESCROW_PROGRESSION.indexOf(status as EscrowStatus);
  if (i < 0 || i === ESCROW_PROGRESSION.length - 1) return null;
  return ESCROW_PROGRESSION[i + 1];
}

/** Narrowing guard over ESCROW_PROGRESSION. */
export function isEscrowStatus(value: string): value is EscrowStatus {
  return (ESCROW_PROGRESSION as readonly string[]).includes(value);
}

export const messageSelect = {
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
  sender: { select: participantSelect },
} satisfies Prisma.ChatMessageSelect;

export type ThreadMessage = Prisma.ChatMessageGetPayload<{
  select: typeof messageSelect;
}>;

/** Oldest first, matching how the thread renders. */
export async function getMessages(
  thread: DealThread,
  take = 200,
): Promise<ThreadMessage[]> {
  const where: Prisma.ChatMessageWhereInput =
    thread.kind === "ORDER"
      ? { orderId: thread.threadId }
      : { bidId: thread.threadId };

  return prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take,
    select: messageSelect,
  });
}
