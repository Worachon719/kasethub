import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { countAlertMatches } from "@/lib/alerts";
import { currentUser, type SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/market", label: "ตลาด / Marketplace" },
  { href: "/market?surplusOnly=true", label: "สินค้าล้นสวน" },
  { href: "/brokers", label: "โบรกเกอร์" },
  { href: "/dashboard", label: "แดชบอร์ดเกษตรกร" },
];

const ROLE_LABEL: Record<SessionUser["role"], string> = {
  FARMER: "เกษตรกร",
  BROKER: "ผู้รับซื้อ",
  BUYER: "ผู้ซื้อ",
  ADMIN: "ผู้ดูแลระบบ",
};

/**
 * Primary site chrome.
 *
 * A server component so account state is read once on the server rather than
 * fetched by every page. Reading the session here also makes each page that
 * renders the header dynamic, which all of them already are.
 */
export async function SiteHeader() {
  const user = await currentUser().catch(() => null);
  const canList = !user || user.role === "FARMER" || user.role === "ADMIN";

  // Only brokers and buyers get alerts, and only they pay for the count. With
  // no watches set up the query short-circuits inside countAlertMatches without
  // touching the lots table, so the common case costs one indexed lookup.
  const alertCount =
    user && (user.role === "BROKER" || user.role === "BUYER" || user.role === "ADMIN")
      ? await countAlertMatches(user.id).catch(() => 0)
      : 0;

  return (
    <header className="sticky top-10 z-40 border-b border-hairline bg-white">
      <div className="mx-auto flex h-16 max-w-canvas items-center gap-6 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald text-base font-extrabold text-white">
            K
          </span>
          <span className="text-lg font-extrabold tracking-tight text-ink">
            KasetHub
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}

          {user?.role === "BROKER" || user?.role === "BUYER" || user?.role === "ADMIN" ? (
            <Link
              href="/alerts"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
            >
              แจ้งเตือน
              {alertCount > 0 ? (
                <span
                  className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-harvest px-1 text-[11px] font-bold text-white tabular"
                  aria-label={`มี ${alertCount} ล็อตที่ตรงกับการเฝ้าดู`}
                >
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              ) : null}
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {canList ? (
            <Link
              href="/sell"
              className="hidden h-11 items-center rounded-lg bg-emerald px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-dark sm:inline-flex"
            >
              + ลงขายด่วน
            </Link>
          ) : null}

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-[14rem] truncate text-sm font-semibold text-ink">
                  {user.name}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {ROLE_LABEL[user.role]}
                </p>
              </div>
              <SignOutButton className="inline-flex h-11 items-center rounded-lg border-[1.5px] border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-[#f8fafc] disabled:opacity-50" />
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-lg border-[1.5px] border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-[#f8fafc]"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register"
                className="hidden h-11 items-center rounded-lg border-[1.5px] border-emerald px-4 text-sm font-semibold text-emerald transition-colors hover:bg-optimal-bg sm:inline-flex"
              >
                สมัครสมาชิก
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-white">
      <div className="mx-auto flex max-w-canvas flex-col gap-4 px-4 py-8 text-sm text-ink-muted md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="font-semibold text-ink">KasetHub</p>
          <p>
            ระบบระบายสต็อกผัก-ผลไม้ก่อนเน่าเสีย
            / Surplus produce rescue marketplace
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-ink">
            เงื่อนไขการใช้งาน
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            ความเป็นส่วนตัว
          </Link>
        </div>
      </div>
    </footer>
  );
}
