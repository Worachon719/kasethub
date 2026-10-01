"use client";

import { signIn } from "next-auth/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "FARMER" | "BROKER" | "BUYER";

type Province = { id: string; nameTh: string };

type FormState = {
  role: Role;
  nameTh: string;
  email: string;
  phone: string;
  password: string;
  businessName: string;
  provinceId: string;
  district: string;
  lineId: string;
  whatsapp: string;
};

const EMPTY: FormState = {
  role: "FARMER",
  nameTh: "",
  email: "",
  phone: "",
  password: "",
  businessName: "",
  provinceId: "",
  district: "",
  lineId: "",
  whatsapp: "",
};

const ROLES: {
  value: Role;
  title: string;
  kicker: string;
  quote: string;
  body: string;
  perks: string[];
  cta: string;
  icon: "plant" | "store" | "basket";
}[] = [
  {
    value: "FARMER",
    title: "เกษตรกร / ชาวสวน",
    kicker: "FARMER & GROWER",
    quote: "“ฉันต้องการขายและระบายผลผลิต”",
    body: "ลงขายผลผลิตด่วนก่อนเน่าเสีย เข้าถึงโรงงานและผู้รับซื้อทั่วไทย ได้รับเงินคุ้มครอง Escrow 100% ไม่ถูกกดราคา",
    perks: [
      "โพสต์ล็อตผลผลิตด่วนได้ใน 2 นาที ผ่านมือถือ",
      "0% ค่าธรรมเนียมแรกเข้า",
      "มีรถร่วมสหกรณ์ในระบบ",
    ],
    cta: "เลือกแล้ว",
    icon: "plant",
  },
  {
    value: "BROKER",
    title: "ผู้รับซื้อ / โรงงาน / โบรกเกอร์",
    kicker: "BUYER & BROKER",
    quote: "“ฉันต้องการรวบรวมปริมาณให้ได้ในราคาดี”",
    body: "เอกสารแปลงเพาะปลูกครบ ตรวจสอบย้อนกลับได้ พร้อมวงเงินเครดิตการค้าและทะเบียนผู้รับซื้อมาตรฐาน",
    perks: [
      "เอกสารแปลงเพาะปลูกครบ ตรวจสอบย้อนกลับได้",
      "วงเงินเครดิตการค้า",
      "ขึ้นทะเบียนในรายชื่อผู้รับซื้อ",
    ],
    cta: "เลือกบทบาทนี้",
    icon: "store",
  },
  {
    value: "BUYER",
    title: "ผู้บริโภคทั่วไป / สั่งร่วม",
    kicker: "RETAIL & GROUP BUY",
    quote: "“ฉันอยากซื้อสดจากสวนในราคาสมเหตุสมผล”",
    body: "สั่งร่วมซื้อผลผลิตสดเป็นกลุ่ม สะสมแต้ม KasetPoint และรับสินค้าที่มีมาตรฐานรับรอง",
    perks: [
      "สั่งร่วมซื้อราคาถูกกว่าตลาด",
      "สะสมแต้ม KasetPoint",
      "ร้านค้าเปิดทำการ 24 ชม.",
    ],
    cta: "เลือกบทบาทนี้",
    icon: "basket",
  },
];

const STEP_LABELS = [
  { n: "01", th: "เลือกบทบาท", en: "Select Role" },
  { n: "02", th: "ข้อมูลส่วนตัว & กิจการ", en: "Profile & Business" },
  { n: "03", th: "ยืนยันตัวตน (KYC)", en: "Verification & Farm" },
  { n: "04", th: "เริ่มซื้อขายผลผลิต", en: "Ready to Trade" },
];

const DESTINATION: Record<Role, string> = {
  FARMER: "/dashboard",
  BROKER: "/market",
  BUYER: "/market",
};

/**
 * Four-step registration wizard.
 *
 * The role picked in step 1 decides which fields steps 2-3 ask for and which
 * page the account lands on. The account is created with a single POST to
 * /api/auth/register, then signed in through next-auth so the session cookie
 * matches the credentials path used at login.
 */
export function RegisterWizard({ provinces }: { provinces: Province[] }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const roleMeta = useMemo(
    () => ROLES.find((r) => r.value === form.role) ?? ROLES[0],
    [form.role],
  );

  const step1Valid = true;
  const step2Valid = form.nameTh.trim().length >= 2 && form.email.trim().length > 0;
  const step3Valid = form.password.length >= 8;

  // Guards against a double submit landing in the same tick as the first, which
  // would create two accounts — the unique index on email rejects the second,
  // but only after the user has already seen a spurious "email already exists".
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPending(true);

    const payload = {
      role: form.role,
      nameTh: form.nameTh.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
      provinceId: form.provinceId || undefined,
      district: form.district.trim() || undefined,
      lineId: form.lineId.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      businessName:
        form.role === "BROKER" ? form.businessName.trim() || undefined : undefined,
    };

    // Set once the account exists and the user is being redirected. Every other
    // exit releases the lock so the form is retryable; the success path must
    // not, or a click landing mid-navigation would create a second account.
    let succeeded = false;

    try {
      const created = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!created.ok) {
        const detail = (await created.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(detail?.error?.message ?? "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      const signedIn = await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        redirect: false,
      });

      if (signedIn?.error) {
        setError(
          "สร้างบัญชีสำเร็จ แต่เข้าสู่ระบบไม่อัตโนมัติ กรุณาเข้าสู่ระบบด้วยตัวเอง",
        );
        return;
      }

      succeeded = true;
      window.location.assign(DESTINATION[form.role]);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      if (!succeeded) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }

  function next() {
    if (step === 2 && !step3Valid) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setError(null);
    if (step < 3) setStep(step + 1);
    else void submit();
  }

  return (
    <div>
      {/* Step progress */}
      <section className="rounded-2xl border border-hairline bg-white p-4 md:p-6">
        <ol className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STEP_LABELS.map((s, i) => (
            <li key={s.n} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold",
                  i < step && "bg-emerald text-white",
                  i === step && "bg-emerald text-white shadow-md",
                  i > step &&
                    "bg-surface-2 text-ink-muted",
                )}
              >
                {s.n}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-[11px] font-bold uppercase tracking-wider",
                    i <= step ? "text-emerald" : "text-ink-muted",
                  )}
                >
                  ขั้นตอนที่ {i + 1}
                </span>
                <span className="block truncate text-base font-semibold text-ink">
                  {s.th}
                </span>
                <span className="hidden truncate text-xs text-ink-muted sm:block">
                  {s.en}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-emerald transition-all duration-500"
            style={{ width: `${((step + 1) / 4) * 100}%` }}
          />
        </div>
      </section>

      {/* Step body */}
      <div className="mt-6">
        {step === 0 ? (
          <div
            role="radiogroup"
            aria-label="ประเภทบัญชีผู้ใช้"
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            {ROLES.map((r) => {
              const selected = form.role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set("role", r.value)}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl bg-white p-5 text-left transition-all",
                    selected
                      ? "ring-2 ring-emerald shadow-float"
                      : "border border-hairline hover:-translate-y-0.5 hover:shadow-float",
                  )}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-xl",
                          selected
                            ? "bg-optimal-bg text-emerald"
                            : "bg-surface-2 text-ink-muted",
                        )}
                        aria-hidden
                      >
                        <RoleIcon name={r.icon} />
                      </span>
                      {selected ? (
                        <span className="rounded-full bg-emerald px-2 py-1 text-[11px] font-bold text-white">
                          เลือกแล้ว
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-lg font-bold text-ink">{r.title}</h2>
                    <p className="text-xs font-semibold text-emerald">
                      {r.kicker}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {r.quote}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                      {r.body}
                    </p>
                  </div>
                  <ul className="mt-4 space-y-1.5">
                    {r.perks.map((perk) => (
                      <li
                        key={perk}
                        className="flex items-start gap-2 text-xs text-ink-secondary"
                      >
                        <span className="mt-0.5 text-emerald" aria-hidden>
                          ✓
                        </span>
                        {perk}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 1 ? (
          <section className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
            <h2 className="text-xl font-bold text-ink">ข้อมูลส่วนตัว &amp; กิจการ</h2>
            <p className="mt-1 text-sm text-ink-muted">
              บทบาทที่เลือก: {roleMeta.title} · {roleMeta.kicker}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nameTh">ชื่อ-นามสกุล / Full name</Label>
                <Input
                  id="nameTh"
                  value={form.nameTh}
                  onChange={(e) => set("nameTh", e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">อีเมล / Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">เบอร์โทรศัพท์ (ไม่บังคับ)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  autoComplete="tel"
                  placeholder="08xxxxxxxx"
                />
              </div>
              {form.role === "BROKER" ? (
                <div>
                  <Label htmlFor="businessName">ชื่อกิจการ / Company</Label>
                  <Input
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) => set("businessName", e.target.value)}
                    placeholder="บจก. …"
                  />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
            <h2 className="text-xl font-bold text-ink">
              ยืนยันตัวตน (KYC)
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              ตั้งรหัสผ่านและกรอกที่ตั้งกิจการ เพื่อให้ผู้ซื้อเชื่อถือโปรไฟล์ของคุณ
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="password">รหัสผ่าน / Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  อย่างน้อย 8 ตัวอักษร
                </p>
              </div>
              <div>
                <Label htmlFor="province">จังหวัด / Province</Label>
                <Select
                  id="province"
                  value={form.provinceId}
                  onChange={(e) => set("provinceId", e.target.value)}
                >
                  <option value="">ไม่ระบุ</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameTh}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="district">อำเภอ/ตำบล (ไม่บังคับ)</Label>
                <Input
                  id="district"
                  value={form.district}
                  onChange={(e) => set("district", e.target.value)}
                />
              </div>
              {form.role !== "BUYER" ? (
                <>
                  <div>
                    <Label htmlFor="lineId">LINE ID (ไม่บังคับ)</Label>
                    <Input
                      id="lineId"
                      value={form.lineId}
                      onChange={(e) => set("lineId", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="whatsapp">WhatsApp (ไม่บังคับ)</Label>
                    <Input
                      id="whatsapp"
                      value={form.whatsapp}
                      onChange={(e) => set("whatsapp", e.target.value)}
                      placeholder="668xxxxxxxx"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
            <h2 className="text-xl font-bold text-ink">เริ่มซื้อขายผลผลิต</h2>
            <p className="mt-1 text-sm text-ink-muted">
              ตรวจสอบข้อมูลก่อนสร้างบัญชี
            </p>

            <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-sm">
              <Row label="บทบาท" value={roleMeta.title} />
              <Row label="ชื่อ" value={form.nameTh || "—"} />
              <Row label="อีเมล" value={form.email || "—"} />
              {form.businessName ? (
                <Row label="กิจการ" value={form.businessName} />
              ) : null}
              <Row
                label="ที่ตั้ง"
                value={
                  [
                    form.district,
                    provinces.find((p) => p.id === form.provinceId)?.nameTh,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "ไม่ระบุ"
                }
              />
            </dl>

            <p className="mt-4 text-xs text-ink-muted">
              เมื่อกดสร้างบัญชี ระบบจะเข้าสู่ระบบให้อัตโนมัติ
            </p>
          </section>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-critical-border bg-critical-bg px-3 py-2 text-sm font-semibold text-critical-fg"
        >
          {error}
        </p>
      ) : null}

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="neutral"
            size="lg"
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
            disabled={pending}
          >
            ย้อนกลับ
          </Button>
        ) : null}

        <Button
          type="button"
          variant="agrarian"
          size="lg"
          onClick={next}
          disabled={pending || (step === 1 && !step2Valid) || (step === 0 && !step1Valid)}
        >
          {step === 3
            ? pending
              ? "กำลังสร้างบัญชี…"
              : "สร้างบัญชีและเริ่มใช้งาน"
            : `ถัดไป: ${STEP_LABELS[step + 1].th}`}
        </Button>

        <p className="text-xs text-ink-muted">ใช้เวลาเพียง 1-2 นาที</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function RoleIcon({ name }: { name: "plant" | "store" | "basket" }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "currentColor" } as const;
  if (name === "plant") {
    return (
      <svg {...common} aria-hidden>
        <path d="M12 2c-1.4 2.6-4.6 3.6-6.5 3.6 1.2 3.6 3.3 5.4 6.5 5.4s5.3-1.8 6.5-5.4C16.6 5.6 13.4 4.6 12 2zM11 12v7H8v3h8v-3h-3v-7h-2z" />
      </svg>
    );
  }
  if (name === "store") {
    return (
      <svg {...common} aria-hidden>
        <path d="M4 4h16l1 5a3 3 0 01-5 2 3 3 0 01-4 0 3 3 0 01-4 0A3 3 0 015 9l-1-5zm1 9h14v7H5v-7z" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M7 7V6a5 5 0 0110 0v1h3l-1 13H5L4 7h3zm2 0h6V6a3 3 0 00-6 0v1z" />
    </svg>
  );
}
