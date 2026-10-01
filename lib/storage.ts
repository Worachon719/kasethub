/**
 * Image storage for both negotiation attachments and lot photography.
 *
 * Two backends, chosen by environment:
 *
 *  1. Supabase Storage (production). When SUPABASE_URL and
 *     SUPABASE_SERVICE_ROLE_KEY are set the image is uploaded to a public
 *     bucket and the row stores the resulting absolute URL.
 *  2. Inline data URL (local dev / preview without storage configured). The
 *     compressed data URL is stored directly on the row.
 *
 * The fallback exists so image upload works on a fresh clone with nothing but
 * a Postgres connection string. It is bounded by MAX_INLINE_BYTES; a real
 * deployment should set the Supabase variables so payloads stay small.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "chat-attachments";

/** Supabase Storage row limit for a single object. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Hard cap for the inline fallback. Browsers compress chat photos to roughly
 * 100-250 KB, so this accommodates a generous retry without bloating the row.
 */
export const MAX_INLINE_BYTES = 700 * 1024;

export { MAX_LOT_IMAGES } from "@/lib/upload-limits";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AttachmentResult =
  | { ok: true; url: string; stored: "supabase" | "inline" }
  | { ok: false; message: string; status: number };

export function storageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

type ParsedDataUrl = { mime: string; bytes: Buffer };

/** Split `data:<mime>;base64,<payload>` into a mime type and raw bytes. */
export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  const match = /^data:([a-z]+\/[a-z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl,
  );
  if (!match) return null;

  const mime = match[1].toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime)) return null;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength === 0) return null;

  return { mime, bytes };
}

/** Deterministic-ish object key; no user input is trusted in the path. */
function objectKey(userId: string, mime: string, folder: string): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const rand = Math.random().toString(36).slice(2, 10);
  const ext = mime.split("/")[1] ?? "bin";
  // jpeg is the mime's own name but the conventional file extension is .jpg,
  // and some CDNs key the content type off the extension.
  const safeExt = ext === "jpeg" ? "jpg" : ext;
  return `${folder}/${userId}/${stamp}-${rand}.${safeExt}`;
}

/**
 * Persist a compressed data URL and return the URL to store on the row.
 * Caller has already authenticated the user; `userId` only namespaces the key.
 *
 * `folder` separates the two very different lifecycles sharing this bucket —
 * lot photos are public and permanent, chat attachments are part of a private
 * negotiation. They get different prefixes so a retention policy or a bucket
 * listing can treat them separately.
 */
export async function storeImage(
  dataUrl: string,
  userId: string,
  folder: "chat" | "lots" = "chat",
): Promise<AttachmentResult> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return {
      ok: false,
      status: 422,
      message: `รองรับเฉพาะไฟล์ ${ALLOWED_IMAGE_TYPES.map(
        (t) => t.replace("image/", "").toUpperCase(),
      ).join(", ")}`,
    };
  }

  if (parsed.bytes.byteLength > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      message: "รูปมีขนาดใหญ่เกิน 5 MB กรุณาเลือกรูปที่เล็กลง",
    };
  }

  if (!storageConfigured()) {
    if (parsed.bytes.byteLength > MAX_INLINE_BYTES) {
      return {
        ok: false,
        status: 413,
        message:
          "รูปใหญ่เกินกำหนด — กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY เพื่อเปิดใช้งานอัปโหลดขนาดใหญ่",
      };
    }
    return { ok: true, url: dataUrl, stored: "inline" };
  }

  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const key = objectKey(userId, parsed.mime, folder);

  const response = await fetch(
    `${base}/storage/v1/object/${BUCKET}/${key}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": parsed.mime,
        "x-upsert": "false",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      body: new Uint8Array(parsed.bytes),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[storage] upload failed", response.status, detail);
    return {
      ok: false,
      status: 502,
      message: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }

  return {
    ok: true,
    url: `${base}/storage/v1/object/public/${BUCKET}/${key}`,
    stored: "supabase",
  };
}

/**
 * Upload every photo on a lot, preserving order.
 *
 * Order matters: index 0 is the cover, and lot cards, the market grid and the
 * lot hero all render images[0]. Returns on the first failure rather than
 * continuing, so a partial set is never written.
 */
export async function storeLotImages(
  dataUrls: readonly string[],
  userId: string,
): Promise<
  { ok: true; urls: string[] } | { ok: false; message: string; status: number; index: number }
> {
  const urls: string[] = [];

  // Sequential, not Promise.all: this runs against a single storage endpoint
  // and each call is a network round trip. Five at once adds no throughput and
  // makes the failure index ambiguous.
  for (let index = 0; index < dataUrls.length; index += 1) {
    const result = await storeImage(dataUrls[index], userId, "lots");
    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status, index };
    }
    urls.push(result.url);
  }

  return { ok: true, urls };
}

/**
 * True for a URL this app is willing to render in an <img>. Blocks javascript:
 * and other script-bearing schemes that could otherwise be stored by a client.
 */
export function isSafeImageUrl(value: string): boolean {
  if (value.startsWith("data:image/")) return parseDataUrl(value) !== null;
  return /^https:\/\/[^\s]+$/i.test(value);
}
