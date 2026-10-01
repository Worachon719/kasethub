"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatThb, formatWeight } from "@/lib/utils";

/**
 * Image downscaler for chat attachments.
 *
 * Photos taken on a phone are 3-8 MB, which is far too large to inline. The
 * canvas re-encode lands them in the 100-250 KB range that the inline storage
 * fallback accepts, and if Supabase Storage is configured the same payload is
 * uploaded there instead. Longest edge is capped at 1600 px.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.72;

export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", QUALITY);
}

export type Attachment = { dataUrl: string; alt: string; bytes: number };

/** Hidden file input that returns a compressed data URL, or null on cancel. */
export function ImagePicker({
  onPick,
  disabled,
  label = "แนบรูป/ตราชั่ง",
}: {
  onPick: (attachment: Attachment) => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("รองรับเฉพาะไฟล์รูปภาพ");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      onPick({
        dataUrl,
        alt: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
        bytes: Math.round((dataUrl.length - dataUrl.indexOf(",")) * 0.75),
      });
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="neutral"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        title="แนบรูปถ่ายยืนยันผลผลิตหรือตราชั่ง"
      >
        {busy ? "กำลังย่อรูป…" : `📎 ${label}`}
      </Button>
      {error ? <span className="text-xs text-critical-fg">{error}</span> : null}
    </>
  );
}

/** Small preview with a remove control, shown above the composer. */
export function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-2 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.dataUrl}
        alt={attachment.alt}
        className="h-14 w-14 rounded-md object-cover"
      />
      <div className="min-w-0 text-xs">
        <p className="truncate font-semibold text-ink">{attachment.alt}</p>
        <p className="tabular text-ink-muted">
          {(attachment.bytes / 1024).toFixed(0)} KB
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="ml-auto"
      >
        ลบ
      </Button>
    </div>
  );
}

/**
 * Offer card rendered inside the transcript for counter-offers.
 * Terms come from the message row, not the parent thread, so each card shows
 * the price that was actually on the table at that point in the negotiation.
 */
export function OfferCard({
  pricePerKg,
  quantityKg,
  mine,
}: {
  pricePerKg: number | null;
  quantityKg: number | null;
  mine: boolean;
}) {
  const total =
    pricePerKg !== null && quantityKg !== null
      ? Math.round(pricePerKg * quantityKg)
      : null;

  return (
    <div
      className={`rounded-xl border p-3 ${
        mine
          ? "border-emerald bg-optimal-bg"
          : "border-hairline bg-surface-2"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
        ข้อเสนอราคาใหม่จาก{mine ? "คุณ" : "คู่เจรจา"}
      </p>
      <p className="tabular mt-1 text-xl font-extrabold text-emerald">
        {pricePerKg !== null ? formatThb(pricePerKg) : "—"}
        <span className="text-sm font-semibold"> / กก.</span>
      </p>
      {quantityKg !== null ? (
        <p className="tabular text-sm text-ink-secondary">
          {formatWeight(quantityKg)}
          {total !== null ? (
            <>
              {" · "}
              <span className="text-ink-muted">
                (ยอดชำระสุทธิ: {formatThb(total)})
              </span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Autoscrolling transcript container. */
export function useStickyScroll(dependency: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Only follow the tail when the reader is already near the bottom, so
    // scrolling back through an offer is not yanked away by a new message.
    const nearBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight < 160;
    if (nearBottom) node.scrollTop = node.scrollHeight;
  }, [dependency]);

  return ref;
}

/** Reload the page after a mutation that changes what a route renders. */
export function useDealRefresh(dealId: string, onDone?: () => void) {
  const router = useRouter();
  return () => {
    router.refresh();
    onDone?.();
    void dealId;
  };
}
