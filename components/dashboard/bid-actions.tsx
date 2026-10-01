"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Approve / reject an incoming bid from the farmer dashboard.
 *
 * Approving runs the escrow transaction server-side and returns the new order
 * id, so the follow-up link opens the deal room for the settled order rather
 * than the original bid thread.
 */
export function BidApprovalActions({ bidId }: { bidId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderHref, setOrderHref] = useState<string | null>(null);
  // `disabled={pending}` only takes effect after React re-renders, so two clicks
  // in the same tick could both reach acceptBid. The second would then fail on
  // the now-ACCCEPTED bid and surface a confusing 409. The ref closes that gap.
  const inFlight = useRef(false);

  async function resolve(status: "ACCEPTED" | "REJECTED") {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { data?: { order?: { id: string } }; error?: { message?: string } }
        | null;

      if (!res.ok) {
        setError(payload?.error?.message ?? "ดำเนินการไม่สำเร็จ");
        return;
      }

      const orderId = payload?.data?.order?.id;
      if (orderId) {
        setOrderHref(`/deals/${orderId}`);
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (orderHref) {
    return (
      <Link
        href={orderHref}
        className="inline-flex h-9 items-center rounded-lg bg-emerald px-3 text-[13px] font-semibold text-white hover:bg-emerald-dark"
      >
        เปิดห้องเจรจา
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="agrarian"
          size="sm"
          disabled={pending}
          onClick={() => void resolve("ACCEPTED")}
        >
          {pending ? "กำลังบันทึก…" : "อนุมัติ"}
        </Button>
        <Button
          variant="neutral"
          size="sm"
          disabled={pending}
          onClick={() => void resolve("REJECTED")}
        >
          ไม่ผ่าน
        </Button>
        <Link
          href={`/deals/${bidId}`}
          className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold text-ink-secondary hover:bg-surface-2"
        >
          เจรจา
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-critical-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Buyer-side bid row: withdraw a pending offer, or reopen the negotiation room
 * once the farmer has replied.
 */
export function MyBidActions({
  bidId,
  status,
}: {
  bidId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function withdraw() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/bids/${bidId}`, { method: "DELETE" });
      if (!res.ok) {
        // Previously this refreshed unconditionally, so a rejected or failed
        // withdraw looked identical to a successful one: the row came back
        // unchanged and the buyer assumed the offer had been pulled.
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "ถอนข้อเสนอไม่สำเร็จ");
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Link
          href={`/deals/${bidId}`}
          className="inline-flex h-9 items-center rounded-lg border-[1.5px] border-hairline bg-white px-3 text-[13px] font-semibold text-ink hover:bg-surface-2"
        >
          {status === "ACCEPTED" ? "ดูดีล" : "เจรจา"}
        </Link>
        {status === "PENDING" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => void withdraw()}
          >
            {pending ? "กำลังถอน…" : "ถอน"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-critical-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
