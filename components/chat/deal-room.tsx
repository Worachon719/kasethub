"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AttachmentPreview,
  ImagePicker,
  OfferCard,
  useStickyScroll,
  type Attachment,
} from "@/components/chat/chat-parts";
import { Button } from "@/components/ui/button";
import { nextEscrowStep } from "@/lib/deal";
import { cn, formatThb, formatWeight } from "@/lib/utils";

type Sender = {
  id: string;
  name: string;
  role: string;
  verification: string;
  avatarUrl: string | null;
};

export type DealMessage = {
  id: string;
  bidId: string | null;
  orderId: string | null;
  senderId: string;
  body: string;
  imageUrl: string | null;
  imageAlt: string | null;
  kind: "TEXT" | "OFFER" | "SYSTEM";
  offerPricePerKg: number | null;
  offerQuantityKg: number | null;
  createdAt: string;
  sender: Sender;
};

export type DealContext = {
  kind: "BID" | "ORDER";
  threadId: string;
  lot: {
    id: string;
    lotCode: string;
    titleTh: string;
    titleEn: string;
    variety: string | null;
    grade: string;
    coldChain: string;
    organic: boolean;
    gapCertified: boolean;
    isSurplus: boolean;
    availableQtyKg: number;
    minOrderKg: number;
    askPricePerKg: number;
    district: string | null;
    province: string | null;
    expiresAt: string | null;
    auctionEndsAt: string | null;
  };
  farmer: Sender;
  counterparty: Sender;
  terms: {
    pricePerKg: number;
    quantityKg: number;
    totalThb: number;
    escrowThb: number;
    status: string;
    expiresAt: string | null;
    accepted: boolean;
  };
  orderStatus: string | null;
  orderCode: string | null;
  viewer: {
    isFarmer: boolean;
    isCounterparty: boolean;
    canAccept: boolean;
    canCounterOffer: boolean;
    canAdvanceEscrow: boolean;
    canSendMessage: boolean;
    role: string;
  };
};

const QUICK_REPLIES = [
  { emoji: "🤝", label: "ขอเจรจาต่อ" },
  { emoji: "📷", label: "📷 ขอรูปล่าสุด" },
  { emoji: "🏷️", label: "🏷️ เสนอราคาใหม่" },
  { emoji: "🚚", label: "🚚 นัดวันรับสินค้า" },
  { emoji: "📑", label: "📑 ขอใบรับรอง GAP" },
];

const ROLE_LABEL: Record<string, string> = {
  FARMER: "เจ้าของสวน",
  BROKER: "ผู้รับซื้อ",
  BUYER: "ผู้ซื้อ",
  ADMIN: "ผู้ดูแลระบบ",
};

/** Refetch interval while the tab is visible, in milliseconds. */
const POLL_MS = 12_000;

/**
 * Negotiation room for a bid or an order.
 *
 * Server-rendered for the first paint, then kept live by polling
 * GET /api/deals/:id/messages. Polling was chosen over a socket layer because
 * the transcript is low-frequency and the same endpoint is useful to external
 * clients; the cost is one indexed query per poll per open thread.
 */
export function DealRoom({
  initial,
  initialMessages,
  viewerId,
}: {
  initial: DealContext;
  initialMessages: DealMessage[];
  viewerId: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which action owns the room right now. One state rather than a flag per
  // button: accept, send and counter-offer all mutate the same thread, so
  // letting two run at once produced duplicate offers and a send that landed in
  // a thread the accept had just turned into an order. `null` means idle.
  const [busy, setBusy] = useState<"send" | "accept" | "counter" | "advance" | null>(null);
  const [draft, setDraft] = useState("");
  // `bytes` drives the size shown under the preview and the client-side guard
  // before a large image is uploaded, so it is kept alongside the data URL
  // rather than recomputed on each render.
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);

  const scrollRef = useStickyScroll(messages.length);

  // Every mutating control in the room shares one lock, so nothing in the
  // sidebar, the composer or the quick replies can be fired while a request is
  // already in flight.
  const locked = busy !== null;
  const canAct = initial.viewer.canSendMessage && !locked;

  // The single legal next milestone, recomputed from the server value. Both
  // the button's label and its PATCH body come from this one variable so they
  // cannot disagree — a button reading "อัปเดต" while posting a different
  // status is how an order silently 409s itself.
  const nextStep = nextEscrowStep(initial.orderStatus ?? "");

  // Keep local state aligned when the server component re-renders with new
  // data (after a counter-offer or an accept, which both bump the thread).
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${initial.threadId}/messages`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { data: DealMessage[] };
      setMessages(body.data);
    } catch {
      // A failed poll is not surfaced: the next tick will pick up the change.
    }
  }, [initial.threadId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void load();
      }, POLL_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") start();
      else stop();
    });

    return () => {
      stop();
      document.removeEventListener("visibilitychange", stop);
    };
  }, [load]);

  const other = initial.viewer.isFarmer
    ? initial.counterparty
    : initial.farmer;

  async function send(body: string, imageDataUrl?: string) {
    if (busy) return;
    setError(null);
    setBusy("send");
    try {
      const res = await fetch(`/api/deals/${initial.threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          imageDataUrl,
          imageAlt: attachment?.alt,
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(detail?.error?.message ?? "ส่งข้อความไม่สำเร็จ");
        return;
      }
      const body2 = (await res.json()) as { data: DealMessage };
      setMessages((prev) =>
        prev.some((m) => m.id === body2.data.id) ? prev : [...prev, body2.data],
      );
      setDraft("");
      setAttachment(null);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    if (busy) return;
    setError(null);
    setBusy("accept");
    try {
      const res = await fetch(`/api/deals/${initial.threadId}/accept`, {
        method: "POST",
      });
      const payload = (await res.json().catch(() => null)) as
        | { data?: { orderId?: string; message?: string }; error?: { message?: string } }
        | null;

      if (!res.ok) {
        setError(payload?.error?.message ?? "ยืนยันดีลไม่สำเร็จ");
        return;
      }
      setNotice(payload?.data?.message ?? "ปิดดีลเรียบร้อย");
      // The bid thread becomes an order thread, so navigate rather than refresh.
      if (payload?.data?.orderId) {
        window.location.assign(`/deals/${payload.data.orderId}`);
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function counterOffer(pricePerKg: number, quantityKg: number) {
    if (busy) return;
    setError(null);
    setBusy("counter");
    try {
      const res = await fetch(`/api/deals/${initial.threadId}/counter-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePerKg, quantityKg }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(detail?.error?.message ?? "ยื่นข้อเสนอไม่สำเร็จ");
        return;
      }
      setOfferOpen(false);
      setNotice("ส่งข้อเสนอราคาใหม่แล้ว");
      await load();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function advanceEscrow() {
    if (busy || !nextStep) return;
    setError(null);
    setNotice(null);
    setBusy("advance");
    // The try only wraps the request. Anything thrown by the code after it
    // would be reported as an unreachable server, which is how a saved order
    // once told the user nothing had happened.
    let ok = false;
    try {
      const res = await fetch(`/api/orders/${initial.threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStep }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "อัปเดตสถานะเงินประกันไม่สำเร็จ");
        return;
      }
      ok = true;
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }

    if (ok) {
      setNotice(`อัปเดตเป็น “${STATUS_LABEL[nextStep] ?? nextStep}” แล้ว`);
      // The gauge and this button both read `initial.orderStatus`, which only
      // the server knows, so a refresh is the only way to advance the UI.
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Transcript + composer */}
      <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-hairline bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 md:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-ink">
              ห้องเจรจาซื้อขายล็อต #{initial.lot.lotCode}
            </h2>
            <p className="truncate text-xs text-ink-muted">
              กำลังคุยกับ {other.name} ·{" "}
              {ROLE_LABEL[other.role] ?? other.role}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-optimal-bg px-2 py-1 text-[11px] font-semibold text-optimal-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
            ระบบทำงานปกติ
          </span>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">
              ยังไม่มีข้อความ — เริ่มต้นการเจรจาด้านล่าง
            </p>
          ) : null}

          {messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
              >
                <p className="text-[11px] font-semibold text-ink-muted">
                  {mine ? "คุณ" : m.sender.name}
                  <span className="ml-2 tabular font-normal">
                    {new Date(m.createdAt).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>

                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    mine
                      ? "bg-emerald text-white"
                      : "bg-surface-2 text-ink",
                  )}
                >
                  {m.kind === "OFFER" ? (
                    <OfferCard
                      pricePerKg={m.offerPricePerKg}
                      quantityKg={m.offerQuantityKg}
                      mine={mine}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}

                  {m.imageUrl ? (
                    <a href={m.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt={m.imageAlt ?? "รูปแนบจากคู่เจรจา"}
                        className="max-h-64 w-full rounded-lg object-cover"
                      />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {notice ? (
          <p className="border-t border-optimal-border bg-optimal-bg px-4 py-2 text-xs font-semibold text-optimal-fg md:px-6">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="border-t border-critical-border bg-critical-bg px-4 py-2 text-xs font-semibold text-critical-fg md:px-6"
          >
            {error}
          </p>
        ) : null}

        <div className="space-y-3 border-t border-hairline p-4 md:px-6">
          {attachment ? (
            <AttachmentPreview
              attachment={attachment}
              onRemove={() => setAttachment(null)}
            />
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setDraft((d) => (d ? `${d} ${q.label}` : q.label))}
                disabled={!canAct}
                className="rounded-full border border-hairline bg-white px-3 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <ImagePicker
              label="แนบรูป"
              disabled={!canAct}
              onPick={(next) => {
                setError(null);
                setAttachment(next);
              }}
            />

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              disabled={!canAct}
              placeholder="พิมพ์ข้อความ…"
              aria-label="ข้อความ"
              className="min-h-[44px] flex-1 resize-y rounded-[10px] border border-[#cbd5e1] px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
            />

            <Button
              type="button"
              variant="agrarian"
              onClick={() => void send(draft, attachment?.dataUrl)}
              disabled={!canAct || (!draft.trim() && !attachment)}
            >
              {busy === "send" ? "กำลังส่ง…" : "ส่ง"}
            </Button>
          </div>
        </div>
      </section>

      {/* Deal summary sidebar */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-hairline bg-white p-4 md:p-5">
          <h2 className="text-lg font-semibold text-ink">
            รายละเอียดล็อต
          </h2>
          <p className="mt-1 text-sm font-semibold text-ink">
            {initial.lot.titleTh}
          </p>
          <p className="text-xs text-ink-muted">
            {initial.lot.titleEn}
            {initial.lot.variety ? ` · ${initial.lot.variety}` : ""}
          </p>

          <dl className="mt-3 space-y-1.5 text-sm">
            <SideRow label="เกรด" value={initial.lot.grade} />
            <SideRow
              label="ที่ตั้ง"
              value={[initial.lot.district, initial.lot.province]
                .filter(Boolean)
                .join(" / ") || "ไม่ระบุ"}
            />
            <SideRow label="คงเหลือ" value={formatWeight(initial.lot.availableQtyKg)} />
            <SideRow label="ขั้นต่ำ" value={formatWeight(initial.lot.minOrderKg)} />
            <SideRow label="Cold Chain" value={initial.lot.coldChain} />
            <SideRow
              label="มาตรฐาน"
              value={[
                initial.lot.gapCertified ? "GAP" : null,
                initial.lot.organic ? "ออร์แกนิก" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "ไม่ระบุ"}
            />
          </dl>
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-4 md:p-5">
          <h2 className="text-lg font-semibold text-ink">
            ราคาข้อเสนอล่าสุด
          </h2>
          <p className="tabular mt-1 text-3xl font-extrabold text-emerald">
            {formatThb(initial.terms.pricePerKg)}
            <span className="text-base"> / กก.</span>
          </p>
          <p className="tabular mt-1 text-sm text-ink-secondary">
            มูลค่ารวม: {formatThb(initial.terms.totalThb)} (
            {formatWeight(initial.terms.quantityKg)})
          </p>
          <p className="tabular text-sm text-ink-muted">
            วางเงินค้ำประกัน Escrow (100%):{" "}
            <span className="font-semibold text-ink">
              {formatThb(initial.terms.escrowThb)}
            </span>
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            สถานะข้อเสนอ:{" "}
            <span className="font-semibold text-ink">
              {STATUS_LABEL[initial.terms.status] ?? initial.terms.status}
            </span>
          </p>

          {initial.viewer.canAccept ? (
            <Button
              variant="transactional"
              className="mt-4 w-full"
              onClick={() => void accept()}
              disabled={locked}
            >
              {busy === "accept" ? "กำลังยืนยัน…" : "ยืนยันปิดดีลราคานี้"}
            </Button>
          ) : null}

          {initial.viewer.canCounterOffer ? (
            <Button
              variant="neutral"
              className="mt-4 w-full"
              onClick={() => setOfferOpen(true)}
              disabled={locked}
            >
              ปรับเปลี่ยนข้อเสนอราคา
            </Button>
          ) : null}

          {initial.viewer.canAdvanceEscrow && nextStep ? (
            <Button
              variant="transactional"
              className="mt-4 w-full"
              onClick={() => void advanceEscrow()}
              disabled={locked}
            >
              {busy === "advance"
                ? "กำลังอัปเดต…"
                : `ย้ายไปขั้น: ${STATUS_LABEL[nextStep] ?? nextStep}`}
            </Button>
          ) : null}

          {initial.kind === "ORDER" && !initial.viewer.canAdvanceEscrow ? (
            <p className="mt-4 rounded-xl bg-optimal-bg px-3 py-2 text-xs font-semibold text-optimal-fg">
              {initial.terms.status === "COMPLETED"
                ? "ปิดดีลสำเร็จ — เงินถูกปล่อยให้เกษตรกรแล้ว"
                : initial.terms.status === "CANCELLED"
                  ? "ดีลนี้ถูกยกเลิกแล้ว"
                  : "ดูสถานะขั้นตอนได้จากแถบ Escrow ด้านบน"}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-4 text-sm md:p-5">
          <p className="text-xs font-semibold text-ink-muted">
            KasetHub Escrow
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            ประวัติการเจรจาทั้งหมดถูกบันทึกบนบล็อกเชนเกษตร ปกติ PromptPay
            Escrow ปลอดภัย 100%
          </p>
        </div>
      </aside>

      {offerOpen ? (
        <CounterOfferDialog
          currentPrice={initial.terms.pricePerKg}
          currentQty={initial.terms.quantityKg}
          minOrderKg={initial.lot.minOrderKg}
          availableQtyKg={initial.lot.availableQtyKg}
          busy={busy === "counter"}
          onCancel={() => setOfferOpen(false)}
          onSubmit={(price, qty) => void counterOffer(price, qty)}
        />
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอการยืนยัน",
  ACCEPTED: "ตกลงแล้ว",
  REJECTED: "ไม่ผ่าน",
  WITHDRAWN: "ถูกถอน",
  EXPIRED: "หมดอายุ",
  ESCROW_DEPOSITED: "วางเงินประกันแล้ว",
  QUALITY_INSPECTED: "ตรวจสอบคุณภาพแล้ว",
  LOADED_SHIPPED: "ขนส่งแล้ว",
  COMPLETED: "ปิดดีลสำเร็จ",
  DISPUTED: "มีข้อโต้แย้ง",
  CANCELLED: "ยกเลิก",
};

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

/**
 * Counter-offer modal.
 *
 * Step buttons mirror the design's -0.50 / +0.50 / +1.00 shortcuts, and the
 * escrow total recomputes live so the farmer's approval is not a surprise.
 */
function CounterOfferDialog({
  currentPrice,
  currentQty,
  minOrderKg,
  availableQtyKg,
  busy,
  onCancel,
  onSubmit,
}: {
  currentPrice: number;
  currentQty: number;
  minOrderKg: number;
  availableQtyKg: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (price: number, qty: number) => void;
}) {
  const [price, setPrice] = useState(currentPrice);
  const [qty, setQty] = useState(currentQty);

  const total = Math.round(price * qty);
  const qtyInvalid =
    qty < minOrderKg || qty > availableQtyKg || qty <= 0 || price <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="counter-offer-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-float md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="counter-offer-title"
            className="text-xl font-bold text-ink"
          >
            ยื่นข้อเสนอราคาใหม่ (Counter-Offer)
          </h2>
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="ปิด">
            ✕
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="offer-price"
              className="mb-1.5 block text-sm font-semibold text-ink-secondary"
            >
              ราคาต่อกิโลกรัม (บาท / กก.)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">฿</span>
              <input
                id="offer-price"
                type="number"
                step="0.5"
                min="0.5"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="tabular h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
              />
            </div>
            <div className="mt-2 flex gap-2">
              {[-0.5, 0.5, 1].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() =>
                    setPrice((p) =>
                      Math.max(0.5, Math.round((p + step) * 100) / 100),
                    )
                  }
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-surface-2"
                >
                  {step > 0 ? `+${step.toFixed(2)} ฿` : `${step.toFixed(2)} ฿`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="offer-qty"
              className="mb-1.5 block text-sm font-semibold text-ink-secondary"
            >
              ปริมาณ (กก.)
            </label>
            <input
              id="offer-qty"
              type="number"
              step="1"
              min={minOrderKg}
              max={availableQtyKg}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="tabular h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
            />
            <p className="mt-1 text-xs text-ink-muted">
              ขั้นต่ำ {formatWeight(minOrderKg)} · คงเหลือ{" "}
              {formatWeight(availableQtyKg)}
            </p>
          </div>

          <dl className="space-y-1 rounded-lg bg-surface-2 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">มูลค่ารวมทั้งล็อต</dt>
              <dd className="tabular font-semibold text-ink">
                {formatThb(total)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">วางเงินค้ำประกัน Escrow (100%)</dt>
              <dd className="tabular font-semibold text-emerald">
                {formatThb(total)}
              </dd>
            </div>
          </dl>

          {qtyInvalid ? (
            <p className="text-xs font-semibold text-critical-fg">
              ปริมาณต้องอยู่ระหว่าง {formatWeight(minOrderKg)} และ{" "}
              {formatWeight(availableQtyKg)}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="neutral" onClick={onCancel} disabled={busy}>
            ยกเลิก
          </Button>
          <Button
            variant="transactional"
            onClick={() => {
              // Guard here as well as via `disabled`: a click that lands in the
              // same tick as the previous submit would otherwise post a second
              // offer before React re-renders the disabled state.
              if (!busy && !qtyInvalid) onSubmit(price, qty);
            }}
            disabled={busy || qtyInvalid}
          >
            {busy ? "กำลังส่ง…" : "ส่งข้อเสนอทันที"}
          </Button>
        </div>
      </div>
    </div>
  );
}
