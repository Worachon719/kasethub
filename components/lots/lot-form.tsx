"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LotImagePicker, type LotPhoto } from "@/components/lots/lot-image-picker";
import { CATEGORIES } from "@/lib/categories";

const GRADES = [
  { value: "A", label: "เกรด A — ส่งออก" },
  { value: "B", label: "เกรด B" },
  { value: "C", label: "เกรด C" },
  { value: "PROCESSING", label: "สำหรับป้อนโรงงาน" },
];

const COLD_CHAIN = [
  { value: "AMBIENT", label: "อุณหภูมิปกติ (Ambient)" },
  { value: "CHILLED", label: "เย็น 2-8°C (Chilled)" },
  { value: "FROZEN", label: "แช่แข็ง (Frozen)" },
];

/** Days from now to an ISO string, for the default expiry. */
function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * ลงขายผลผลิต — farmer listing form.
 *
 * Posts to POST /api/lots; the farmer identity comes from the session, so the
 * form has no owner field. Expiry defaults to three days out because surplus
 * rescue is time-critical and the urgency facet keys off expiresAt.
 */
export function LotForm({ provinces }: { provinces: { id: string; nameTh: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Photos in cover-first order; index 0 becomes LotImage.sortOrder 0. */
  const [photos, setPhotos] = useState<LotPhoto[]>([]);
  // Creating a lot is not idempotent, so a double submit publishes two
  // listings. `disabled={pending}` covers the next render; the ref covers the
  // same-tick second click that never sees it.
  const inFlight = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const num = (k: string) => {
      const raw = String(form.get(k) ?? "").trim();
      return raw === "" ? undefined : Number(raw);
    };
    const date = (k: string) => {
      const raw = String(form.get(k) ?? "").trim();
      return raw === "" ? undefined : new Date(`${raw}T08:00:00`);
    };

    // Held on the success path only: the lot exists and the browser is
    // navigating to it, so the lock must not be released into that navigation.
    let created = false;

    try {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleTh: String(form.get("titleTh") ?? "").trim(),
          titleEn: String(form.get("titleEn") ?? "").trim(),
          category: String(form.get("category") ?? "FRESH_FRUIT"),
          grade: String(form.get("grade") ?? "A"),
          variety: String(form.get("variety") ?? "").trim() || undefined,
          askPricePerKg: num("askPricePerKg"),
          quantityKg: num("quantityKg"),
          minOrderKg: num("minOrderKg") ?? 1,
          provinceId: String(form.get("provinceId") ?? "") || undefined,
          district: String(form.get("district") ?? "").trim() || undefined,
          coldChain: String(form.get("coldChain") ?? "AMBIENT"),
          organic: form.get("organic") === "on",
          gapCertified: form.get("gapCertified") === "on",
          isSurplus: form.get("isSurplus") === "on",
          description: String(form.get("description") ?? "").trim() || undefined,
          harvestDate: date("harvestDate"),
          expiresAt: date("expiresAt"),
          images: photos.map((p) => p.dataUrl),
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { data?: { id: string }; error?: { message?: string; issues?: { path: string; message: string }[] } }
        | null;

      if (!res.ok) {
        const issues = payload?.error?.issues;
        setError(
          issues?.length
            ? issues.map((i) => `${i.path}: ${i.message}`).join(" · ")
            : payload?.error?.message ?? "บันทึกไม่สำเร็จ",
        );
        return;
      }

      if (payload?.data?.id) {
        created = true;
        window.location.assign(`/lots/${payload.data.id}`);
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      if (!created) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
        <h2 className="text-lg font-semibold text-ink">ข้อมูลผลผลิต</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="titleTh" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              ชื่อผลผลิต (ไทย) *
            </label>
            <input
              id="titleTh"
              name="titleTh"
              required
              maxLength={160}
              placeholder="มะม่วงน้ำดอกไม้เกรดส่งออก"
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
            />
          </div>
          <div>
            <label htmlFor="titleEn" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              ชื่อผลผลิต (อังกฤษ) *
            </label>
            <input
              id="titleEn"
              name="titleEn"
              required
              maxLength={160}
              placeholder="Export Grade Nam Dok Mai Mango"
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none focus:ring-[3px] focus:ring-[rgba(21,128,61,0.15)]"
            />
          </div>
          <div>
            <label htmlFor="category" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              หมวดหมู่ *
            </label>
            <select
              id="category"
              name="category"
              defaultValue="FRESH_FRUIT"
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.th} / {c.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="grade" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              เกรด
            </label>
            <select
              id="grade"
              name="grade"
              defaultValue="A"
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            >
              {GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="variety" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              พันธุ์
            </label>
            <input
              id="variety"
              name="variety"
              maxLength={80}
              placeholder="น้ำดอกไม้, หอมทอง"
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="coldChain" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              การเก็บรักษา
            </label>
            <select
              id="coldChain"
              name="coldChain"
              defaultValue="CHILLED"
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            >
              {COLD_CHAIN.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="description" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
            รายละเอียดเพิ่มเติม
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="วิธีเก็บเกี่ยว เงื่อนไขการรับสินค้า ขนส่ง"
            className="w-full resize-y rounded-[10px] border border-[#cbd5e1] px-3 py-2 text-sm focus:border-emerald focus:outline-none"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
        <h2 className="text-lg font-semibold text-ink">ราคาและปริมาณ</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="askPricePerKg" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              ราคาเสนอ (฿/กก.) *
            </label>
            <input
              id="askPricePerKg"
              name="askPricePerKg"
              type="number"
              step="0.5"
              min="0.5"
              required
              className="tabular h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="quantityKg" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              ปริมาณรวม (กก.) *
            </label>
            <input
              id="quantityKg"
              name="quantityKg"
              type="number"
              step="1"
              min="1"
              required
              className="tabular h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="minOrderKg" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              ขั้นต่ำ (กก.)
            </label>
            <input
              id="minOrderKg"
              name="minOrderKg"
              type="number"
              step="1"
              min="1"
              defaultValue="100"
              className="tabular h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
        <h2 className="text-lg font-semibold text-ink">สถานที่และอายุเก็บรักษา</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="provinceId" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              จังหวัด <span className="text-critical-fg">*</span>
            </label>
            <select
              id="provinceId"
              name="provinceId"
              defaultValue=""
              required
              aria-describedby="provinceId-hint"
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            >
              <option value="" disabled>
                — เลือกจังหวัด —
              </option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameTh}
                </option>
              ))}
            </select>
            <p id="provinceId-hint" className="mt-1 text-xs text-ink-muted">
              จำเป็นสำหรับการจัดส่ง — ผู้ซื้อใช้จังหวัดนี้ในการคำนวณเส้นทางขนส่ง
            </p>
          </div>
          <div>
            <label htmlFor="district" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              อำเภอ/ตำบล
            </label>
            <input
              id="district"
              name="district"
              maxLength={80}
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="harvestDate" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              วันที่เก็บเกี่ยว
            </label>
            <input
              id="harvestDate"
              name="harvestDate"
              type="date"
              defaultValue={isoInDays(0)}
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="expiresAt" className="mb-1.5 block text-sm font-semibold text-ink-secondary">
              หมดอายุ
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              defaultValue={isoInDays(3)}
              className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
            />
            <p className="mt-1 text-xs text-ink-muted">
              ช่วงนี้ขับเคลื่อนป้าย “ขายด่วน” และตัวกรองระดับความด่วน
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
        <h2 className="text-lg font-semibold text-ink">มาตรฐานและรูปภาพ</h2>
        <div className="mt-4 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              name="isSurplus"
              defaultChecked
              className="h-5 w-5 rounded border-2 border-[#cbd5e1] text-emerald"
            />
            สินค้าล้นสวน (Surplus)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              name="organic"
              className="h-5 w-5 rounded border-2 border-[#cbd5e1] text-emerald"
            />
            ออร์แกนิก
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              name="gapCertified"
              className="h-5 w-5 rounded border-2 border-[#cbd5e1] text-emerald"
            />
            มาตรฐาน GAP
          </label>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink-secondary">
            รูปผลผลิต
          </h3>
          <p className="mb-3 text-xs text-ink-muted">
            รูปช่วยให้ผู้ซื้อตัดสินใจเร็วขึ้นมาก โดยเฉพาะสินค้าล้นสวนที่มีเวลานับถอยหลัง —
            ล็อตที่มีรูปจริงได้ราคาดีกว่าล็อตไม่มีรูป
          </p>
          <LotImagePicker
            photos={photos}
            onChange={setPhotos}
            disabled={pending}
          />
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-critical-border bg-critical-bg px-3 py-2 text-sm font-semibold text-critical-fg"
        >
          {error}
        </p>
      ) : null}

      {/**
       * Stated before the submit button, not after. KasetHub only carries goods
       * between Thai provinces, so a farmer with produce abroad should learn
       * that here rather than after a rejected listing.
       */}
      <p className="flex items-start gap-2 rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
        <svg
          viewBox="0 0 20 20"
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M10 1.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM10 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1zm0 8.25a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          <strong className="font-semibold text-ink">
            จัดส่งเฉพาะภายในประเทศไทย
          </strong>{" "}
          — KasetHub เชื่อมต่อเกษตรกรกับผู้ซื้อที่รับซื้อและขนส่งในประเทศไทยเท่านั้น
          กรุณาเลือกจังหวัดที่ตั้งแปลงผลผลิต
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="agrarian" size="lg" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "ประกาศขาย"}
        </Button>
        <p className="text-xs text-ink-muted">
          ล็อตจะถูกผูกกับบัญชีของคุณโดยอัตโนมัติจาก session
        </p>
      </div>
    </form>
  );
}
