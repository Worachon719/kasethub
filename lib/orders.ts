import { prisma } from "@/lib/prisma";

/** Platform commission on the gross subtotal, as a fraction. */
export const PLATFORM_FEE_RATE = 0.03;

/**
 * Interactive-transaction bounds.
 *
 * Prisma's defaults are maxWait 2s / timeout 5s. On a cold pooled Supabase
 * connection the accept can sit in the queue longer than that; when the timeout
 * fires the engine hands the connection back to the pool while the client still
 * believes the transaction is open, and the next statement fails with P2028
 * "Transaction already closed". The bid is then left mid-flight and the farmer
 * sees a 500 for what is really a contention outcome. 30s of headroom costs
 * nothing — every statement below is an indexed single-row write.
 *
 * Exported so every interactive transaction in the app opts in; a bare
 * `prisma.$transaction(async (tx) => …)` is what reintroduces the race.
 */
export const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export type AcceptedOrder = {
  id: string;
  orderCode: string;
  status: string;
  subtotalThb: number;
  platformFee: number;
  netPayoutThb: number;
};

export type AcceptBidResult =
  | { ok: true; bidId: string; order: AcceptedOrder }
  | { ok: false; status: number; message: string };

/** Candidate codes drawn per attempt; one of them is free in every realistic case. */
const CODE_POOL = 6;

/** KH-ORD-YYMMDD-XXXX */
function orderCodeCandidate(now = new Date()): string {
  const stamp = [
    now.getFullYear().toString().slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `KH-ORD-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** A code with ~2^30 extra combinations, used when the random pool is exhausted. */
function orderCodeFallback(): string {
  return `KH-ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    1000 + Math.random() * 9000,
  )}`;
}

/**
 * Claim an unused order code.
 *
 * This is a *read-only* pre-check, so it runs on the root client, outside the
 * transaction, and concurrently with the bid lookup — the accept used to spend
 * an extra round trip inside the transaction window purely to confirm a string
 * was free. `@unique` on orderCode remains the real guarantee: if two accepts
 * both slip past this check, the loser's insert fails with P2002, the
 * transaction rolls back whole (the bid is still PENDING), and the caller
 * re-draws a code and retries the entire accept.
 */
async function claimOrderCode(): Promise<string> {
  const candidates = Array.from({ length: CODE_POOL }, () => orderCodeCandidate());
  const taken = await prisma.order.findMany({
    where: { orderCode: { in: candidates } },
    select: { orderCode: true },
  });
  const used = new Set(taken.map((row) => row.orderCode));
  return candidates.find((code) => !used.has(code)) ?? orderCodeFallback();
}

/**
 * Accept a bid and open the escrow order in one transaction.
 *
 * Steps, in order, so a failure anywhere leaves nothing half-applied:
 *   1. mark the winning bid ACCEPTED
 *   2. reject every other PENDING bid on the same lot
 *   3. reserve the lot
 *   4. log the clearing price
 *   5. create the order with escrow already funded
 *
 * The order starts at ESCROW_DEPOSITED because the bid is only acceptable once
 * the buyer has committed funds; the money movement itself is out of scope here.
 *
 * Two deliberate structural choices:
 *
 * - Everything readable is read *before* the transaction opens, concurrently.
 *   Nothing inside the transaction needs to read, so it holds a pooled
 *   connection for writes only.
 * - The five statements inside stay sequential. They touch distinct rows, so
 *   `Promise.all` would buy nothing at the database (one connection executes
 *   them in order regardless) while making the transaction's JS-side await
 *   chain the fastest path to a timeout. Concurrent queries on a single
 *   interactive transaction are also the documented way to provoke P2028 on
 *   Prisma's binary engine — the exact error this function used to raise. The
 *   parallelisation belongs in the read phase above, which is where it is free.
 */
export async function acceptBid(bidId: string): Promise<AcceptBidResult> {
  // --- Read phase: outside the transaction, concurrent, on the root client. ---
  const [bid, orderCode] = await Promise.all([
    prisma.bid.findUnique({
      where: { id: bidId },
      select: {
        id: true,
        lotId: true,
        bidderId: true,
        status: true,
        pricePerKg: true,
        quantityKg: true,
        lot: { select: { id: true, farmerId: true } },
      },
    }),
    claimOrderCode(),
  ]);

  if (!bid) return { ok: false, status: 404, message: "Bid not found" };
  if (bid.status !== "PENDING") {
    return { ok: false, status: 409, message: `Bid already ${bid.status}` };
  }
  if (!bid.lot.farmerId) {
    return {
      ok: false,
      status: 409,
      message: "This lot has no seller, so it cannot be sold",
    };
  }

  const sellerId = bid.lot.farmerId;
  const subtotal = Math.round(bid.pricePerKg * bid.quantityKg);
  const platformFee = Math.round(subtotal * PLATFORM_FEE_RATE);
  const netPayout = subtotal - platformFee;

  // --- Write phase: one transaction, sequential writes, no reads. ------------
  try {
    const order = await prisma.$transaction(async (tx) => {
      await tx.bid.update({
        where: { id: bid.id },
        data: { status: "ACCEPTED" },
      });

      await tx.bid.updateMany({
        where: { lotId: bid.lotId, id: { not: bid.id }, status: "PENDING" },
        data: { status: "REJECTED" },
      });

      await tx.lot.update({
        where: { id: bid.lotId },
        data: { status: "RESERVED" },
      });

      await tx.priceLog.create({
        data: {
          lotId: bid.lotId,
          pricePerKg: bid.pricePerKg,
          source: "BID_ACCEPTED",
        },
      });

      return tx.order.create({
        data: {
          orderCode,
          lotId: bid.lotId,
          buyerId: bid.bidderId,
          sellerId,
          quantityKg: bid.quantityKg,
          pricePerKg: bid.pricePerKg,
          subtotalThb: subtotal,
          platformFee,
          netPayoutThb: netPayout,
          status: "ESCROW_DEPOSITED",
          events: {
            create: {
              status: "ESCROW_DEPOSITED",
              actorId: bid.bidderId,
              note: "วางเงินประกัน / Escrow deposited",
            },
          },
        },
        select: {
          id: true,
          orderCode: true,
          status: true,
          subtotalThb: true,
          platformFee: true,
          netPayoutThb: true,
        },
      });
    }, TRANSACTION_OPTIONS);

    return { ok: true, bidId: bid.id, order };
  } catch (error) {
    return mapAcceptError(error, bidId);
  }
}

type PrismaError = Error & { code?: string; meta?: { target?: unknown } };

/** True for a P2002 that landed on the orderCode unique index. */
function isOrderCodeClash(error: unknown): boolean {
  const e = error as PrismaError;
  if (e?.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes("orderCode");
  return typeof target === "string" ? target.includes("orderCode") : true;
}

/**
 * Turn a failed accept into something the client can act on.
 *
 * These are contention outcomes, not code defects, so none of them should reach
 * the client as a 500. The one case worth retrying transparently is losing the
 * orderCode race: the transaction rolled back whole, so re-running the accept is
 * exactly as safe as running it the first time.
 */
function mapAcceptError(error: unknown, bidId: string): AcceptBidResult {
  const e = error as PrismaError;

  if (isOrderCodeClash(error)) {
    console.error("[orders] orderCode collision on accept", bidId);
    return {
      ok: false,
      status: 503,
      message: "Could not allocate an order number. Please retry.",
    };
  }

  switch (e?.code) {
    // P2028 — the interactive transaction's connection was closed under us.
    // P2034 — rolled back for a write conflict or a deadlock.
    case "P2028":
    case "P2034":
      console.error("[orders] accept contended", e.code, e.message);
      return {
        ok: false,
        status: 409,
        message: "This deal changed while you were confirming it. Please retry.",
      };

    // Row-version conflict: another accept already moved the bid out of PENDING.
    case "P2025":
      return {
        ok: false,
        status: 409,
        message: "This bid was accepted by someone else",
      };

    default:
      throw error;
  }
}
