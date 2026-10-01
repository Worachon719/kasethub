"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/chat/chat-parts";
import { formatThb, formatWeight } from "@/lib/utils";

type Lot = {
  id: string;
  titleTh: string;
  askPricePerKg: number;
  availableQtyKg: number;
  minOrderKg: number;
};

type Bid = {
  id: string;
  pricePerKg: number;
  quantityKg: number;
  status: string;
  createdAt: string;
  lot: { id: string; titleTh: string; lotCode: string };
  bidder: { id: string; nameTh: string | null; verification: string };
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอเกษตรกรอนุมัติ",
  ACCEPTED: "ตกลงแล้ว",
  REJECTED: "ไม่ผ่าน",
  WITHDRAWN: "ถูกถอน",
  EXPIRED: "หมดอายุ",
};

/**
 * Place a bid on a lot.
 *
 * The bidder is taken from the session server-side; this form only sends the
 * commercial terms. Prices default to the farmer's ask so a first offer is one
 * tap away, and the escrow total recomputes as the quantity changes.
 */
export function BidForm({ lot }: { lot: Lot }) {
  const router = useRouter();
  const [price, setPrice] = useState(lot.askPricePerKg);
  const [quantity, setQuantity] = useState(lot.minOrderKg);
  const [note, setNote] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const inFlight = useRef(false);

  const total = Math.round(price * quantity);
  const overAvailable = quantity > lot.availableQtyKg;
  const belowMinimum = quantity < lot.minOrderKg;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setDone(null);
    setPending(true);

    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: lot.id,
          pricePerKg: price,
          quantityKg: quantity,
          note: [note, imageDataUrl ? "แนบรูปยืนยันผลผลิต" : null]
            .filter(Boolean)
            .join(" — ") || undefined,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { data?: { id: string }; error?: { message?: string } }
        | null;

      if (!res.ok) {
        setError(payload?.error?.message ?? "ส่งข้อเสนอไม่สำเร็จ");
        return;
      }

      setDone("ส่งข้อเสนอแล้ว — เกษตรกรจะตอบในห้องเจรจา");
      setNote("");
      setImageDataUrl(null);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label
          htmlFor="bid-price"
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          ราคาต่อกิโลกรัม (บาท / กก.)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">฿</span>
          <input
            id="bid-price"
            type="number"
            step="0.5"
            min="0.5"
            required
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="tabular h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
          />
        </div>
        <div className="mt-2 flex gap-2">
          {[-1, 0, 0.5, 1, 2].map((step) => (
            <button
              key={step}
              type="button"
              onClick={() =>
                setPrice((p) => Math.max(0.5, Math.round((p + step) * 100) / 100))
              }
              className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-surface-2"
            >
              {step > 0 ? `+${step.toFixed(2)}` : step === 0 ? "ราคาหน้าสวน" : `${step.toFixed(2)}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="bid-qty"
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          ปริมาณที่ต้องการ (กก.)
        </label>
        <input
          id="bid-qty"
          type="number"
          step="1"
          required
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="tabular h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
        />
        <p className="mt-1 text-xs text-ink-muted">
          ขั้นต่ำ {formatWeight(lot.minOrderKg)} · คงเหลือ{" "}
          {formatWeight(lot.availableQtyKg)}
        </p>
      </div>

      <div className="rounded-lg bg-surface-2 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">มูลค่ารวม</span>
          <span className="tabular font-semibold text-ink">
            {formatThb(total)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">วางเงินค้ำประกัน Escrow</span>
          <span className="tabular font-semibold text-emerald">
            {formatThb(total)}
          </span>
        </div>
      </div>

      {belowMinimum || overAvailable ? (
        <p className="text-xs font-semibold text-critical-fg">
          {belowMinimum
            ? `ปริมาณต้องไม่น้อยกว่า ${formatWeight(lot.minOrderKg)}`
            : `ปริมาณเกินคงเหลือ ${formatWeight(lot.availableQtyKg)}`}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="bid-note"
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          หมายเหตุถึงเกษตรกร (ไม่บังคับ)
        </label>
        <textarea
          id="bid-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น พร้อมรับที่สวน, ต้องการใบรับรอง GAP"
          className="w-full resize-y rounded-[10px] border border-[#cbd5e1] px-3 py-2 text-sm focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ImagePicker
          onPick={(a) => setImageDataUrl(a.dataUrl)}
          label="แนบรูปยืนยันผลผลิต"
        />
        {imageDataUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImageDataUrl(null)}
          >
            ลบรูป
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-critical-border bg-critical-bg px-3 py-2 text-sm font-semibold text-critical-fg"
        >
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="rounded-lg border border-optimal-border bg-optimal-bg px-3 py-2 text-sm font-semibold text-optimal-fg">
          {done}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="transactional"
        className="w-full"
        disabled={pending || belowMinimum || overAvailable}
      >
        {pending ? "กำลังส่ง…" : "ยื่นข้อเสนอราคา"}
      </Button>

      <p className="text-xs text-ink-muted">
        การยื่นข้อเสนอถูกบันทึกในชื่อบัญชีที่เข้าสู่ระบบ · เงินจะถูกล็อกในบัญชีกลางเมื่อเกษตรกร
        ยืนยัน
      </p>
    </form>
  );
}

/**
 * Bid board with accept / withdraw controls.
 *
 * Accept and reject are the farmer's; withdraw is the bidder's. Each control
 * calls the route with the session user and refreshes on success.
 */
export function BidBoard({
  bids,
  viewerId,
  isOwner,
}: {
  bids: Bid[];
  viewerId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `pendingId` only reaches the DOM after a render, so a double click in the
  // same tick would issue two accepts. The second would then lose on the
  // already-ACCEPTED bid and show a spurious 409 next to a successful trade.
  const inFlight = useRef<string | null>(null);

  async function act(bidId: string, method: "PATCH" | "DELETE", body?: unknown) {
    if (inFlight.current === bidId) return;
    inFlight.current = bidId;
    setError(null);
    setPendingId(bidId);
    try {
      const res = await fetch(`/api/bids/${bidId}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(detail?.error?.message ?? "ดำเนินการไม่สำเร็จ");
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      inFlight.current = null;
      setPendingId(null);
    }
  }

  if (bids.length === 0) {
    return (
      <p className="p-4 text-sm text-ink-muted">
        ยังไม่มีผู้เสนอราคา — เป็นผู้รายแรกที่ยื่นข้อเสนอ
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-lg border border-critical-border bg-critical-bg px-3 py-2 text-xs font-semibold text-critical-fg"
        >
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-hairline">
        {bids.map((bid) => {
          const canResolve = isOwner && bid.status === "PENDING";
          const canWithdraw = bid.bidder.id === viewerId && bid.status === "PENDING";

          return (
            <li key={bid.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {bid.bidder.nameTh ?? "ผู้ซื้อ"}
                  </p>
                  <p className="tabular text-xs text-ink-muted">
                    {formatWeight(bid.quantityKg)} ·{" "}
                    {new Date(bid.createdAt).toLocaleDateString("th-TH", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm font-bold text-emerald">
                    {formatThb(bid.pricePerKg)} / กก.
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {STATUS_LABEL[bid.status] ?? bid.status}
                  </p>
                </div>
              </div>

              {canResolve || canWithdraw ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {canResolve ? (
                    <>
                      <Button
                        variant="agrarian"
                        size="sm"
                        disabled={pendingId === bid.id}
                        onClick={() => void act(bid.id, "PATCH", { status: "ACCEPTED" })}
                      >
                        {pendingId === bid.id ? "กำลังยืนยัน…" : "ยืนยันรับข้อเสนอ"}
                      </Button>
                      <Button
                        variant="neutral"
                        size="sm"
                        disabled={pendingId === bid.id}
                        onClick={() => void act(bid.id, "PATCH", { status: "REJECTED" })}
                      >
                        ไม่ผ่าน
                      </Button>
                    </>
                  ) : null}
                  {canWithdraw ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === bid.id}
                      onClick={() => void act(bid.id, "DELETE")}
                    >
                      ถอนข้อเสนอ
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
