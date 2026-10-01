"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/categories";
import { CATEGORIES } from "@/lib/categories";

type Province = { id: string; nameTh: string };

type Watch = {
  id: string;
  category: string;
  label: string | null;
  minQuantityKg: number | null;
  province: { id: string; nameTh: string } | null;
};

function describe(w: Watch): string {
  const parts = [categoryLabel(w.category)];
  parts.push(w.province ? `จังหวัด${w.province.nameTh}` : "ทั่วประเทศไทย");
  if (w.minQuantityKg) parts.push(`ตั้งแต่ ${w.minQuantityKg.toLocaleString("th-TH")} กก.`);
  return parts.join(" · ");
}

/**
 * Create and delete surplus watches.
 *
 * The form is uncontrolled and reads the DOM on submit rather than mirroring
 * every field into state — it is five inputs that get read exactly once. What
 * it does track is the in-flight lock, because "save watch" is not idempotent
 * and a double submit leaves the user with two identical rows and no way to
 * tell which is which.
 */
export function WatchManager({
  provinces,
  watches,
}: {
  provinces: Province[];
  watches: Watch[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPending(true);

    /*
     * Capture the element before the first await, not just the FormData.
     *
     * React nulls `event.currentTarget` as soon as the handler's synchronous
     * portion returns, so by the time the fetch below resolves, reading it
     * again yields null. That is not theoretical: `event.currentTarget.reset()`
     * after the await threw a TypeError, which the catch below then reported as
     * "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" — the watch was saved but the user was told
     * the server was unreachable, and `router.refresh()` never ran so the list
     * silently stayed stale.
     */
    const el = event.currentTarget;
    const form = new FormData(el);
    const provinceId = String(form.get("provinceId") ?? "");
    const qty = String(form.get("minQuantityKg") ?? "").trim();
    const label = String(form.get("label") ?? "").trim();

    // The catch is scoped to the fetch alone, so its message is accurate. A
    // wider try would also swallow a TypeError from the code below and report a
    // perfectly reachable server as unreachable.
    let ok = false;
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: String(form.get("category") ?? "FRESH_FRUIT"),
          provinceId: provinceId || null,
          minQuantityKg: qty === "" ? null : Number(qty),
          label: label || undefined,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "บันทึกการเฝ้าดูไม่สำเร็จ");
        return;
      }
      ok = true;
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      inFlight.current = false;
      setPending(false);
    }

    // Reset the uncontrolled form so the next watch starts from defaults, and
    // pull the new server-rendered list. The lock is already released above, so
    // this cannot strand the form in a pending state.
    if (ok) {
      el.reset();
      router.refresh();
    }
  }

  async function remove(watch: Watch) {
    if (deletingId) return;
    setDeletingId(watch.id);
    setError(null);

    try {
      const res = await fetch(`/api/alerts?id=${encodeURIComponent(watch.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "ลบการเฝ้าดูไม่สำเร็จ");
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={create}
        className="grid gap-4 rounded-2xl border border-hairline bg-white p-5 md:grid-cols-2 md:p-6"
      >
        <div className="md:col-span-2">
          <h2 className="text-lg font-semibold text-ink">ตั้งการแจ้งเตือน</h2>
          <p className="mt-1 text-sm text-ink-muted">
            ระบบจะแจ้งเตือนทุกครั้งที่มีล็อตในหมวดที่คุณเลือก
            ใกล้หมดอายุภายใน 2 วัน เรียงตามเวลาที่เหลือ
          </p>
        </div>

        <div>
          <label
            htmlFor="watch-category"
            className="mb-1.5 block text-sm font-semibold text-ink-secondary"
          >
            หมวดสินค้า *
          </label>
          <select
            id="watch-category"
            name="category"
            defaultValue="FRESH_FRUIT"
            required
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
          <label
            htmlFor="watch-province"
            className="mb-1.5 block text-sm font-semibold text-ink-secondary"
          >
            จังหวัด
          </label>
          <select
            id="watch-province"
            name="provinceId"
            defaultValue=""
            className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
          >
            <option value="">ทั่วประเทศไทย</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameTh}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="watch-qty"
            className="mb-1.5 block text-sm font-semibold text-ink-secondary"
          >
            ปริมาณขั้นต่ำ (กก.)
          </label>
          <input
            id="watch-qty"
            name="minQuantityKg"
            type="number"
            min={1}
            step={1}
            placeholder="เช่น 2000 — เว้นว่างหากไม่จำกัด"
            className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="watch-label"
            className="mb-1.5 block text-sm font-semibold text-ink-secondary"
          >
            ชื่อการเฝ้าดู
          </label>
          <input
            id="watch-label"
            name="label"
            maxLength={80}
            placeholder="เช่น มะม่วงเขียวเสวยจันทบุรี"
            className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" variant="transactional" disabled={pending}>
            {pending ? "กำลังบันทึก…" : "เพิ่มการเฝ้าดู"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm font-semibold text-critical-fg">
              {error}
            </p>
          ) : null}
        </div>
      </form>

      {watches.length > 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-ink">
            การเฝ้าดูของคุณ ({watches.length})
          </h2>
          <ul className="mt-4 divide-y divide-hairline">
            {watches.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {w.label || categoryLabel(w.category)}
                  </p>
                  <p className="text-xs text-ink-muted">{describe(w)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deletingId === w.id}
                  onClick={() => void remove(w)}
                >
                  {deletingId === w.id ? "กำลังลบ…" : "ลบ"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
