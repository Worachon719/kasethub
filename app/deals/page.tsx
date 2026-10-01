import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getTickerQuotes } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { formatThb, formatWeight } from "@/lib/utils";

export const metadata: Metadata = { title: "ดีลของฉัน" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "optimal" | "moderate" | "critical" | "neutral"> = {
  PENDING: "moderate",
  ACCEPTED: "optimal",
  ESCROW_DEPOSITED: "optimal",
  QUALITY_INSPECTED: "optimal",
  LOADED_SHIPPED: "optimal",
  COMPLETED: "neutral",
  REJECTED: "critical",
  WITHDRAWN: "neutral",
  EXPIRED: "neutral",
  DISPUTED: "critical",
  CANCELLED: "neutral",
};

/**
 * ดีลของฉัน — every negotiation thread the signed-in user is party to.
 *
 * A deal room hangs off a Bid before escrow and off an Order after, so both are
 * listed; the same URL scheme (/deals/:id) resolves either.
 */
export default async function DealsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=%2Fdeals");

  const tickerQuotes = await getTickerQuotes(6);

  const [bids, orders] = process.env.DATABASE_URL
    ? await prisma.$transaction([
        prisma.bid.findMany({
          where: {
            OR: [{ bidderId: user.id }, { lot: { farmerId: user.id } }],
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            pricePerKg: true,
            quantityKg: true,
            status: true,
            createdAt: true,
            _count: { select: { messages: true } },
            bidder: { select: { nameTh: true } },
            lot: {
              select: { id: true, lotCode: true, titleTh: true, farmerId: true },
            },
          },
        }),
        prisma.order.findMany({
          where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            orderCode: true,
            status: true,
            quantityKg: true,
            subtotalThb: true,
            createdAt: true,
            buyerId: true,
            sellerId: true,
            lot: { select: { id: true, titleTh: true } },
            buyer: { select: { nameTh: true } },
            seller: { select: { nameTh: true } },
          },
        }),
      ])
    : [[], []];

  const rows = [
    ...bids.map((bid) => ({
      id: bid.id,
      code: bid.lot.lotCode,
      title: bid.lot.titleTh,
      lotId: bid.lot.id,
      kind: "ข้อเสนอ" as const,
      status: bid.status,
      counterpart:
        bid.lot.farmerId === user.id
          ? bid.bidder.nameTh ?? "ผู้ซื้อ"
          : "เกษตรกรเจ้าของล็อต",
      amount: Math.round(bid.pricePerKg * bid.quantityKg),
      volume: bid.quantityKg,
      createdAt: bid.createdAt,
      messages: bid._count.messages,
    })),
    ...orders.map((order) => ({
      id: order.id,
      code: order.orderCode,
      title: order.lot.titleTh,
      lotId: order.lot.id,
      kind: "ดีล Escrow" as const,
      status: order.status,
      counterpart:
        order.buyerId === user.id
          ? order.seller?.nameTh ?? "เกษตรกร"
          : order.buyer?.nameTh ?? "ผู้ซื้อ",
      amount: order.subtotalThb,
      volume: order.quantityKg,
      createdAt: order.createdAt,
      messages: 0,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />

      <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
        <h1 className="text-3xl font-bold text-ink">
          ดีลและการเจรจา
          <span className="block text-base font-normal text-ink-muted">
            My Deals &amp; Negotiations
          </span>
        </h1>

        {rows.length === 0 ? (
          <Card className="mt-6 p-8 text-center">
            <p className="font-semibold text-ink">ยังไม่มีดีล</p>
            <p className="mt-1 text-sm text-ink-muted">
              {user.role === "FARMER" || user.role === "ADMIN" ? (
                <>
                  ลงขายผลผลิตเพื่อเริ่มรับข้อเสนอ —{" "}
                  <Link href="/sell" className="text-emerald underline">
                    ลงขายผลผลิต
                  </Link>
                </>
              ) : (
                <>
                  เสนอราคาในตลาดเพื่อเปิดห้องเจรจา —{" "}
                  <Link href="/market" className="text-emerald underline">
                    ไปที่ตลาด
                  </Link>
                </>
              )}
            </p>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardHeader
              title="รายการดีล"
              subtitle={`${rows.length} รายการ`}
            />
            <ul className="divide-y divide-hairline">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2 md:px-6"
                >
                  <div className="min-w-[12rem] flex-1">
                    {/* Two sibling links rather than one wrapping link: HTML
                        forbids nesting an <a> inside an <a>, and the deal room
                        and the lot it references are both worth reaching. */}
                    <Link
                      href={`/deals/${row.id}`}
                      className="block truncate text-sm font-semibold text-ink hover:text-emerald"
                    >
                      {row.title}
                    </Link>
                    <p className="tabular truncate text-xs text-ink-muted">
                      <Link href={`/lots/${row.lotId}`} className="hover:text-emerald">
                        {row.code}
                      </Link>
                      {" · "}
                      {row.kind} · {row.counterpart}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="tabular text-sm font-bold text-emerald">
                      {formatThb(row.amount)}
                    </p>
                    <p className="tabular text-[11px] text-ink-muted">
                      {formatWeight(row.volume)}
                      {row.messages > 0 ? ` · ${row.messages} ข้อความ` : ""}
                    </p>
                  </div>

                  <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
                    {row.status}
                  </Badge>

                  <ButtonLink href={`/deals/${row.id}`} variant="neutral" size="sm">
                    เปิดห้องเจรจา
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
