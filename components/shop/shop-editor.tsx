"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Shop = {
  shopName: string | null;
  shopDescription: string | null;
  lineId: string | null;
  shopUrl: string;
};

/**
 * Storefront editor.
 *
 * Controlled rather than uncontrolled, because this one differs from the
 * watch form: it loads existing values from the server and the LINE id needs
 * live per-field validation feedback as the user types, since the accepted
 * character set is not obvious. The in-flight ref guards the save, which is a
 * PATCH and happens to be idempotent but would still show a stuck spinner on a
 * double click.
 */
export function ShopEditor({ shop }: { shop: Shop }) {
  const router = useRouter();
  const [shopName, setShopName] = useState(shop.shopName ?? "");
  const [shopDescription, setShopDescription] = useState(shop.shopDescription ?? "");
  const [lineId, setLineId] = useState(shop.lineId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);

  const lineValid = lineId === "" || /^[A-Za-z0-9._-]+$/.test(lineId);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setSaved(false);
    setPending(true);

    try {
      const res = await fetch("/api/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName, shopDescription, lineId }),
      });

      if (!res.ok) {
        // Surface the field-level Zod message when there is one — it is
        // written for the user ("ชื่อร้านยาวเกิน 80 ตัวอักษร") and is more
        // useful than the generic "Validation failed".
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string; issues?: { message: string }[] } }
          | null;
        setError(
          payload?.error?.issues?.[0]?.message ??
            payload?.error?.message ??
            "บันทึกข้อมูลร้านไม่สำเร็จ",
        );
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label
          htmlFor="shopName"
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          ชื่อร้าน *
        </label>
        <input
          id="shopName"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          placeholder="เช่น สวนสมชายมะม่วง"
          className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none"
        />
        <p className="mt-1 text-xs text-ink-muted">
          ชื่อที่ผู้ซื้อเห็นบนหน้าร้าน — เว้นว่างไว้หากยังไม่ต้องการเปิดหน้าร้าน
        </p>
      </div>

      <div>
        <label
          htmlFor="shopDescription"
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          คำแนะนำร้าน
        </label>
        <textarea
          id="shopDescription"
          value={shopDescription}
          onChange={(e) => setShopDescription(e.target.value)}
          rows={5}
          maxLength={600}
          placeholder="เล่าเรื่องแปลงผลผลิต พันธุ์ที่ปลูก มาตรฐานที่ได้ และจังหวัดที่ส่งได้"
          className="w-full rounded-[10px] border border-[#cbd5e1] px-3 py-2.5 text-sm focus:border-emerald focus:outline-none"
        />
        <p className="mt-1 text-xs text-ink-muted">
          {shopDescription.length}/600 · ผู้ซื้อเห็นข้อความนี้บนหน้าร้านสาธารณะ
        </p>
      </div>

      <div>
        <label
          htmlFor="lineId"
          className="mb-1.5 block text-sm font-semibold text-ink-secondary"
        >
          LINE ID
        </label>
        <input
          id="lineId"
          value={lineId}
          onChange={(e) => setLineId(e.target.value.trim())}
          maxLength={80}
          placeholder="somchai.k"
          aria-invalid={!lineValid}
          className="h-11 w-full rounded-[10px] border border-[#cbd5e1] px-3 text-sm focus:border-emerald focus:outline-none aria-[invalid=true]:border-critical-border"
        />
        <p className="mt-1 text-xs text-ink-muted">
          ใส่เฉพาะ ID เช่น <code className="rounded bg-surface-2 px-1">somchai.k</code>{" "}
          (ไม่ต้องใส่ @ หรือลิงก์) — ผู้ซื้อจะเห็นปุ่ม “ติดต่อทาง LINE”
          เมื่อกรอกช่องนี้เท่านั้น
        </p>
        {!lineValid ? (
          <p role="alert" className="mt-1 text-xs font-semibold text-critical-fg">
            LINE ID ต้องเป็นเฉพาะตัวอักษร ตัวเลข จุด ขีดกลาง และขีดก้าง
          </p>
        ) : null}
      </div>

      {/*
        States what the public page will and will not show, because the absence
        of a phone field is a deliberate product decision a grower may otherwise
        read as a missing feature.
      */}
      <p className="rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-secondary">
        หน้าร้านจะแสดงชื่อร้าน คำแนะนำ จังหวัด คะแนนรีวิว และล็อตที่เปิดขายเท่านั้น —
        <strong className="font-semibold text-ink">เบอร์โทรและอีเมลจะไม่แสดงบนหน้าสาธารณะ</strong>{" "}
        เพื่อป้องกันการรบกวน การติดต่อทำผ่านปุ่ม LINE หรือห้องเจรจาในระบบซึ่งบันทึกการสนทนาไว้
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-critical-border bg-critical-bg px-3 py-2 text-sm font-semibold text-critical-fg"
        >
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="rounded-lg border border-optimal-border bg-optimal-bg px-3 py-2 text-sm font-semibold text-optimal-fg">
          บันทึกข้อมูลร้านแล้ว
          {shop.shopName || shopName ? (
            <>
              {" · "}
              <a
                href={shop.shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                ดูหน้าร้าน
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="agrarian"
          disabled={pending || !lineValid}
        >
          {pending ? "กำลังบันทึก…" : "บันทึกข้อมูลร้าน"}
        </Button>
        {shop.shopName ? (
          <a
            href={shop.shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-emerald underline"
          >
            ดูหน้าร้านสาธารณะ
          </a>
        ) : null}
      </div>
    </form>
  );
}
