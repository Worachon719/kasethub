import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BidApprovalActions, MyBidActions } from "@/components/dashboard/bid-actions";
import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getTickerQuotes } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import {
  daysUntil,
  formatThb,
  formatWeight,
  spoilageLevel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * แดชบอร์ด — the signed-in user's own activity.
 *
 * middleware already requires a session, so this resolves the user and shapes
 * the page around their role: farmers see their listings and incoming offers,
 * buyers and brokers see the bids they placed. The two views share the metric
 * strip so the page shape stays stable across roles.
 */
export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=%2Fdashboard");

  const tickerQuotes = await getTickerQuotes(6);
  const isSeller = user.role === "FARMER" || user.role === "ADMIN";

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />

      <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-bold text-ink">
            แดชบอร์ด
            <span className="block text-base font-normal text-ink-muted">
              {isSeller ? "Farmer Dashboard" : "Buyer Dashboard"}
            </span>
          </h1>
          <ButtonLink href={isSeller ? "/sell" : "/market"} variant="agrarian" size="sm">
            {isSeller ? "ลงขายผลผลิต" : "ไปที่ตลาด"}
          </ButtonLink>
        </div>

        {!process.env.DATABASE_URL ? (
          <Card className="mt-6 p-8 text-center">
            <p className="font-semibold text-ink">ยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
            <p className="mt-1 text-sm text-ink-muted">
              ตั้งค่า <code className="rounded bg-surface-2 px-1">DATABASE_URL</code>{" "}
              เพื่อดูข้อมูลแดชบอร์ด
            </p>
          </Card>
        ) : (
          <Suspense
            key={user.id}
            fallback={<p className="mt-6 text-sm text-ink-muted">กำลังโหลด…</p>}
          >
            {isSeller ? (
              <SellerDashboard userId={user.id} name={user.name} />
            ) : (
              <BuyerDashboard userId={user.id} />
            )}
          </Suspense>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

async function SellerDashboard({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [lots, incomingBids, payouts, agg] = await prisma.$transaction([
    prisma.lot.findMany({
      where: { farmerId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        lotCode: true,
        titleTh: true,
        availableQtyKg: true,
        status: true,
        isSurplus: true,
        expiresAt: true,
        _count: { select: { bids: true } },
      },
    }),
    prisma.bid.findMany({
      where: { lot: { farmerId: userId }, status: "PENDING" },
      orderBy: { pricePerKg: "desc" },
      take: 10,
      select: {
        id: true,
        pricePerKg: true,
        quantityKg: true,
        createdAt: true,
        bidder: { select: { nameTh: true, verification: true } },
        lot: { select: { id: true, titleTh: true, lotCode: true } },
      },
    }),
    prisma.order.findMany({
      where: { sellerId: userId, status: "COMPLETED" },
      orderBy: { closedAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderCode: true,
        quantityKg: true,
        netPayoutThb: true,
        closedAt: true,
        buyer: { select: { nameTh: true } },
        lot: { select: { titleTh: true } },
      },
    }),
    prisma.lot.aggregate({
      where: { farmerId: userId, status: { in: ["ACTIVE", "RESERVED"] } },
      _sum: { availableQtyKg: true },
      _count: true,
    }),
  ]);

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader
          title="สรุปยอดขายและปริมาณการระบายผลผลิต"
          subtitle="Surplus Rescue Metric"
        />
        <dl className="grid grid-cols-2 gap-px bg-hairline md:grid-cols-4">
          <Metric label="ล็อตที่เปิดอยู่" value={`${agg._count}`} />
          <Metric
            label="ปริมาณคงคลัง"
            value={formatWeight(agg._sum.availableQtyKg ?? 0)}
          />
          <Metric label="ข้อเสนอรออนุมัติ" value={`${incomingBids.length}`} />
          <Metric label="ดีลที่ปิดสำเร็จ" value={`${payouts.length}`} />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="รายการผลผลิตของฉันและสถานะคลัง"
          subtitle={`My Listed Lots (${lots.length})`}
          action={
            <ButtonLink href="/sell" variant="agrarian" size="sm">
              + เพิ่มล็อต
            </ButtonLink>
          }
        />
        {lots.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">
            ยังไม่มีล็อตที่ลงขาย —{" "}
            <Link href="/sell" className="text-emerald underline">
              ลงขายผลผลิตชุดแรก
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-ink-muted">
                <tr className="h-10">
                  <th className="px-4 text-left font-semibold">รหัสล็อต</th>
                  <th className="px-4 text-left font-semibold">ผลผลิต &amp; ปริมาณ</th>
                  <th className="px-4 text-left font-semibold">หมดอายุ</th>
                  <th className="px-4 text-right font-semibold">ข้อเสนอ</th>
                  <th className="px-4 text-right font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const days = lot.expiresAt ? daysUntil(lot.expiresAt) : null;
                  return (
                    <tr
                      key={lot.id}
                      className="h-14 border-b border-hairline transition-colors hover:bg-[#f1f5f9]"
                    >
                      <td className="tabular px-4">
                        <Link
                          href={`/lots/${lot.id}`}
                          className="text-ink-secondary hover:text-emerald"
                        >
                          {lot.lotCode}
                        </Link>
                      </td>
                      <td className="px-4">
                        <span className="font-semibold text-ink">
                          {lot.titleTh}
                        </span>
                        <span className="tabular block text-xs text-ink-muted">
                          {formatWeight(lot.availableQtyKg)}
                        </span>
                      </td>
                      <td className="px-4">
                        {days !== null ? (
                          <span
                            className={`tabular text-xs font-semibold ${
                              spoilageLevel(lot.expiresAt) === "critical"
                                ? "text-critical-fg"
                                : "text-ink-secondary"
                            }`}
                          >
                            {days < 0 ? "หมดอายุแล้ว" : `${days} วัน`}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">ไม่ระบุ</span>
                        )}
                      </td>
                      <td className="tabular px-4 text-right text-ink-secondary">
                        {lot._count.bids}
                      </td>
                      <td className="px-4 text-right">
                        <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-secondary">
                          {lot.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="ข้อเสนอราคารออนุมัติ"
          subtitle="Incoming Bids — เรียงตามราคาสูงสุด"
        />
        {incomingBids.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">ยังไม่มีข้อเสนอรออนุมัติ</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {incomingBids.map((bid) => (
              <li
                key={bid.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {bid.bidder.nameTh ?? "ผู้ซื้อ"}
                    <span className="ml-2 text-xs font-normal text-ink-muted">
                      {bid.lot.titleTh}
                    </span>
                  </p>
                  <p className="tabular text-xs text-ink-muted">
                    {formatWeight(bid.quantityKg)} ·{" "}
                    {bid.createdAt.toLocaleDateString("th-TH")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="tabular text-sm font-bold text-emerald">
                    {formatThb(bid.pricePerKg)} / กก.
                  </p>
                  <BidApprovalActions bidId={bid.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="ประวัติการขายที่สำเร็จ"
          subtitle="Recent Settled Payouts"
        />
        {payouts.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">ยังไม่มีประวัติการขาย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-ink-muted">
                <tr className="h-10">
                  <th className="px-4 text-left font-semibold">รหัสดีล</th>
                  <th className="px-4 text-left font-semibold">ผลผลิต &amp; ปริมาณ</th>
                  <th className="px-4 text-left font-semibold">ผู้ซื้อ</th>
                  <th className="px-4 text-left font-semibold">ปิดดีลเมื่อ</th>
                  <th className="px-4 text-right font-semibold">ยอดเงินสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((order) => (
                  <tr
                    key={order.id}
                    className="h-14 border-b border-hairline transition-colors hover:bg-[#f1f5f9]"
                  >
                    <td className="tabular px-4">
                      <Link
                        href={`/deals/${order.id}`}
                        className="text-ink-secondary hover:text-emerald"
                      >
                        {order.orderCode}
                      </Link>
                    </td>
                    <td className="px-4">
                      <span className="font-semibold text-ink">
                        {order.lot.titleTh}
                      </span>
                      <span className="tabular block text-xs text-ink-muted">
                        {formatWeight(order.quantityKg)}
                      </span>
                    </td>
                    <td className="px-4 text-ink-secondary">
                      {order.buyer.nameTh ?? "ผู้ซื้อ"}
                    </td>
                    <td className="px-4 text-xs text-ink-muted">
                      {order.closedAt?.toLocaleDateString("th-TH", {
                        dateStyle: "medium",
                      }) ?? "—"}
                    </td>
                    <td className="tabular px-4 text-right font-bold text-ink">
                      {formatThb(order.netPayoutThb)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-ink-muted">
        ข้อมูลของ {name} — บัญชีนี้เห็นเฉพาะล็อต ข้อเสนอ และดีลที่เป็นของคุณเอง
      </p>
    </div>
  );
}

async function BuyerDashboard({ userId }: { userId: string }) {
  const [bids, orders] = await prisma.$transaction([
    prisma.bid.findMany({
      where: { bidderId: userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        pricePerKg: true,
        quantityKg: true,
        status: true,
        createdAt: true,
        _count: { select: { messages: true } },
        lot: { select: { id: true, titleTh: true, lotCode: true } },
      },
    }),
    prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        orderCode: true,
        status: true,
        quantityKg: true,
        subtotalThb: true,
        createdAt: true,
        lot: { select: { titleTh: true } },
        seller: { select: { nameTh: true } },
      },
    }),
  ]);

  const openBids = bids.filter((b) => b.status === "PENDING");
  const committed = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + o.subtotalThb, 0);

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader
          title="สรุปการซื้อของฉัน"
          subtitle="My Buying Activity"
        />
        <dl className="grid grid-cols-2 gap-px bg-hairline md:grid-cols-4">
          <Metric label="ข้อเสนอทั้งหมด" value={`${bids.length}`} />
          <Metric label="รอเกษตรกรตอบ" value={`${openBids.length}`} />
          <Metric label="ดีลในระบบ" value={`${orders.length}`} />
          <Metric label="มูลค่าที่ผูกพัน" value={formatThb(committed)} />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="ข้อเสนอของฉัน"
          subtitle="My Bids — เจรจาต่อได้ในห้องเจรจา"
        />
        {bids.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">
            ยังไม่มีข้อเสนอ —{" "}
            <Link href="/market" className="text-emerald underline">
              ดูตลาดสินค้าล้นสวน
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {bids.map((bid) => (
              <li
                key={bid.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {bid.lot.titleTh}
                    <span className="tabular ml-2 text-xs font-normal text-ink-muted">
                      {bid.lot.lotCode}
                    </span>
                  </p>
                  <p className="tabular text-xs text-ink-muted">
                    {formatWeight(bid.quantityKg)} ·{" "}
                    {bid.createdAt.toLocaleDateString("th-TH", { dateStyle: "medium" })}
                    {bid._count.messages > 0
                      ? ` · ${bid._count.messages} ข้อความ`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="tabular text-sm font-bold text-emerald">
                      {formatThb(bid.pricePerKg)} / กก.
                    </p>
                    <p className="text-[11px] text-ink-muted">{bid.status}</p>
                  </div>
                  <MyBidActions bidId={bid.id} status={bid.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="ดีลในระบบ Escrow" subtitle="My Escrow Orders" />
        {orders.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">ยังไม่มีดีลในระบบ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-ink-muted">
                <tr className="h-10">
                  <th className="px-4 text-left font-semibold">รหัสดีล</th>
                  <th className="px-4 text-left font-semibold">ผลผลิต</th>
                  <th className="px-4 text-left font-semibold">ผู้ขาย</th>
                  <th className="px-4 text-left font-semibold">สถานะ</th>
                  <th className="px-4 text-right font-semibold">ยอดรวม</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="h-14 border-b border-hairline transition-colors hover:bg-[#f1f5f9]"
                  >
                    <td className="tabular px-4">
                      <Link
                        href={`/deals/${order.id}`}
                        className="text-ink-secondary hover:text-emerald"
                      >
                        {order.orderCode}
                      </Link>
                    </td>
                    <td className="px-4">
                      <span className="font-semibold text-ink">
                        {order.lot.titleTh}
                      </span>
                      <span className="tabular block text-xs text-ink-muted">
                        {formatWeight(order.quantityKg)}
                      </span>
                    </td>
                    <td className="px-4 text-ink-secondary">
                      {order.seller?.nameTh ?? "เกษตรกร"}
                    </td>
                    <td className="px-4">
                      <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-secondary">
                        {order.status}
                      </span>
                    </td>
                    <td className="tabular px-4 text-right font-bold text-ink">
                      {formatThb(order.subtotalThb)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-bold text-ink">{value}</dd>
    </div>
  );
}
