"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  MAX_COMPRESSED_BYTES,
  MAX_LOT_IMAGES,
} from "@/lib/upload-limits";

export type LotPhoto = { dataUrl: string; bytes: number; name: string };

/**
 * Re-encode a picked file into a data URL small enough to post as JSON.
 *
 * Moved here from the chat attachment picker so both features share one
 * implementation. Lot photos cap the edge slightly tighter than chat's 1600 px
 * because a lot card renders the cover at roughly 600 px and the detail hero at
 * 1200 px — anything beyond that is bytes a buyer waits for on a slow
 * connection to see no difference.
 */
const MAX_EDGE = 1400;
const QUALITY = 0.72;

async function compress(file: File): Promise<{ dataUrl: string; bytes: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser");
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Always re-encode to JPEG, whatever the source was. A PNG screenshot of a
    // scale ticket is 4 MB as PNG and 90 KB as JPEG, and lot photos come from
    // phones, crop tools and screenshots interchangeably.
    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",")) * 0.75);
    return { dataUrl, bytes };
  } finally {
    bitmap.close();
  }
}

function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Photo picker for the /sell form: up to MAX_LOT_IMAGES photos, in order, with
 * the first one used as the cover on lot cards, the market grid and the detail
 * hero.
 *
 * Order is managed with an explicit "make cover" action rather than drag and
 * drop — the list is at most five items on a phone, and drag handles are
 * unusable with a thumb.
 */
export function LotImagePicker({
  photos,
  onChange,
  disabled,
}: {
  photos: LotPhoto[];
  onChange: (next: LotPhoto[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = photos.length >= MAX_LOT_IMAGES;

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (picked.length === 0) return;

    const room = MAX_LOT_IMAGES - photos.length;
    if (picked.length > room) {
      setError(
        `เลือกได้อีก ${room} รูป (สูงสุด ${MAX_LOT_IMAGES} รูปต่อล็อต) — รูปที่เกินจะถูกข้าม`,
      );
    } else {
      setError(null);
    }

    setBusy(true);
    const accepted: LotPhoto[] = [];
    let failure: string | null = null;

    for (const file of picked) {
      if (accepted.length >= room) break;

      if (!(ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(file.type)) {
        failure = `ข้ามไฟล์ ${file.name} — รองรับเฉพาะ JPEG, PNG, WebP และ GIF`;
        continue;
      }

      try {
        const { dataUrl, bytes } = await compress(file);
        if (bytes > MAX_COMPRESSED_BYTES) {
          failure = `ข้ามไฟล์ ${file.name} — ย่อแล้วยังใหญ่เกิน ${formatKb(MAX_COMPRESSED_BYTES)}`;
          continue;
        }
        accepted.push({ dataUrl, bytes, name: file.name });
      } catch {
        failure = `อ่านไฟล์ ${file.name} ไม่สำเร็จ`;
      }
    }

    if (accepted.length > 0) onChange([...photos, ...accepted]);
    setError(failure);
    setBusy(false);
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  /** Promote a photo to position 0, shifting the rest down. */
  function makeCover(index: number) {
    if (index === 0) return;
    const next = [...photos];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_EXTENSIONS.join(",")}
          multiple
          className="sr-only"
          onChange={handleChange}
          disabled={disabled || full}
        />
        <Button
          type="button"
          variant="neutral"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || full || busy}
        >
          {busy
            ? "กำลังย่อรูป…"
            : full
              ? `ครบแล้ว ${MAX_LOT_IMAGES} รูป`
              : `📷 เพิ่มรูปผลผลิต (${photos.length}/${MAX_LOT_IMAGES})`}
        </Button>
        <span className="text-xs text-ink-muted">
          {full
            ? "ลบรูปที่ไม่ต้องการก่อนเพิ่มรูปใหม่"
            : "รูปแรกจะเป็นภาพปก ระบบย่อขนาดให้อัตโนมัติ"}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-semibold text-critical-fg">
          {error}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {photos.map((photo, index) => (
            <li key={`${photo.name}-${index}`} className="w-28">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.dataUrl}
                  alt={`${photo.name}${index === 0 ? " (ภาพปก)" : ""}`}
                  className="h-24 w-28 rounded-lg border border-hairline object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-emerald px-1.5 py-0.5 text-[10px] font-bold text-white">
                    ปก
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  aria-label={`ลบรูปที่ ${index + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-xs font-bold text-white hover:bg-critical-fg disabled:opacity-50"
                >
                  ×
                </button>
              </div>
              <p className="mt-1 truncate text-[10px] text-ink-muted">
                {photo.name}
              </p>
              <div className="mt-1 flex items-center justify-between gap-1">
                {index === 0 ? (
                  <span className="text-[10px] font-semibold text-emerald">
                    ภาพปก
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    disabled={disabled}
                    className="text-[10px] font-semibold text-ink-secondary underline hover:text-emerald disabled:opacity-50"
                  >
                    ตั้งเป็นปก
                  </button>
                )}
                <span className="tabular text-[10px] text-ink-muted">
                  {formatKb(photo.bytes)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
