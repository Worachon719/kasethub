import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DealRoom, type DealMessage } from "@/components/chat/deal-room";
import { EscrowGauge } from "@/components/escrow-gauge";
import { MarketTicker } from "@/components/market-ticker";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import {
  getMessages,
  isParticipant,
  resolveThread,
  threadCapability,
  toParticipant,
} from "@/lib/deal";
import { getTickerQuotes } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { formatCountdown } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!process.env.DATABASE_URL) return { title: "ห้องเจรจา" };

  const { id } = await params;
  const thread = await resolveThread(id).catch(() => null);
  if (!thread) return { title: "ห้องเจรจา" };

  return {
    title: `เจรจาล็อต ${thread.lot.lotCode}`,
    description: `${thread.lot.titleTh} · ${thread.lot.titleEn}`,
  };
}

/**
 * ห้องเจรจาซื้อขาย — the negotiation room for a bid or an order.
 *
 * `id` is either a Bid id or an Order id. The thread is private to the
 * two parties, so a signed-out or unrelated visitor gets the login redirect or
 * a 404 rather than a glimpse of the negotiation.
 */
export default async function DealPage({ params }: Params) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/deals/${id}`)}`);
  }

  if (!process.env.DATABASE_URL) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-canvas px-4 py-16 md:px-8">
          <div className="rounded-2xl border border-hairline bg-white p-8 text-center">
            <p className="font-semibold text-ink">ยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
            <p className="mt-1 text-sm text-ink-muted">
              ตั้งค่า <code className="rounded bg-surface-2 px-1">DATABASE_URL</code>{" "}
              เพื่อเปิดห้องเจรจา
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const thread = await resolveThread(id);
  if (!thread || !isParticipant(thread, user.id)) notFound();

  const [messages, tickerQuotes] = await Promise.all([
    getMessages(thread),
    getTickerQuotes(6),
  ]);

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />

      <main className="mx-auto max-w-canvas px-4 py-6 md:px-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Link href="/market" className="hover:text-ink">
            ตลาด
          </Link>
          <span>/</span>
          <Link
            href={`/lots/${thread.lot.id}`}
            className="tabular hover:text-ink"
          >
            {thread.lot.lotCode}
          </Link>
          <span>/</span>
          <span className="text-ink">
            {thread.kind === "ORDER" ? "ดีลในระบบ Escrow" : "ต้องเจรจา"}
          </span>
        </nav>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink md:text-3xl">
            ตลาดเจรจาผลผลิต
          </h1>
          {thread.lot.auctionEndsAt ? (
            <span className="tabular rounded-full bg-amber/10 px-3 py-1.5 text-xs font-semibold text-harvest">
              ข้อเสนอยืนราคาถึง{" "}
              {new Date(thread.lot.auctionEndsAt).toLocaleString("th-TH", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              ({formatCountdown(thread.lot.auctionEndsAt)})
            </span>
          ) : null}
        </div>

        {thread.kind === "ORDER" && thread.orderStatus ? (
          <section className="mb-6 rounded-2xl border border-hairline bg-white p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">
                ขั้นตอนปัจจุบัน — Escrow
              </h2>
              <span className="tabular text-sm text-ink-muted">
                รหัสดีล <span className="font-semibold text-ink">{thread.orderCode}</span>
              </span>
            </div>
            <EscrowGauge current={thread.orderStatus as never} />
            <p className="mt-3 text-xs text-ink-muted">
              ยืนยันดีลแล้ว ราคาและปริมาณถูกล็อก การเจรจาต่อได้เฉพาะเรื่องการส่งมอบ
            </p>
          </section>
        ) : null}

        <DealRoom
          initial={{
            kind: thread.kind,
            threadId: thread.threadId,
            lot: thread.lot,
            farmer: thread.farmer,
            counterparty: thread.counterparty,
            terms: thread.terms,
            orderStatus: thread.orderStatus,
            orderCode: thread.orderCode,
            // The server value is what the controls are gated on for the first
            // paint; the client recomputes the same flags after a mutation.
            viewer: {
              ...threadCapability(thread, user.id),
              role: user.role,
            },
          }}
          initialMessages={messages.map(
            (m): DealMessage => ({
              ...m,
              createdAt: m.createdAt.toISOString(),
              // Sender rows come off the user table with the two name columns;
              // the client renders a single display name.
              sender: toParticipant(m.sender),
            }),
          )}
          viewerId={user.id}
        />
      </main>

      <SiteFooter />
    </>
  );
}

