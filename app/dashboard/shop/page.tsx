import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketTicker } from "@/components/market-ticker";
import { ShopEditor } from "@/components/shop/shop-editor";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getTickerQuotes } from "@/lib/queries";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "ข้อมูลร้านของฉัน" };

/**
 * ข้อมูลร้าน — edit the grower's own storefront.
 *
 * middleware already requires a session; the role check here decides whether to
 * render the editor or say why not, so a buyer following the link gets an
 * explanation rather than a 403.
 */
export default async function ShopSettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=%2Fdashboard%2Fshop");

  const tickerQuotes = await getTickerQuotes(6);

  if (user.role !== "FARMER" && user.role !== "ADMIN") {
    return (
      <>
        <MarketTicker quotes={tickerQuotes} />
        <SiteHeader />
        <main className="mx-auto max-w-canvas px-4 py-10 md:px-8">
          <h1 className="text-3xl font-bold text-ink">ข้อมูลร้านของฉัน</h1>
          <Card className="mt-6 p-8 text-center">
            <p className="font-semibold text-ink">หน้าร้านสำหรับเกษตรกร</p>
            <p className="mt-1 text-sm text-ink-muted">
              บัญชีของคุณไม่ได้ลงทะเบียนเป็นเกษตรกร จึงไม่มีหน้าร้านให้จัดการ
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-emerald px-5 text-sm font-bold text-white"
            >
              กลับไปแดชบอร์ด
            </Link>
          </Card>
        </main>
        <SiteFooter />
      </>
    );
  }

  // Reads the full profile here because this page is authenticated and
  // owner-only — the id is the session's, so there is nothing to leak.
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      shopName: true,
      shopDescription: true,
      lineId: true,
      province: { select: { nameTh: true } },
      district: true,
    },
  });

  return (
    <>
      <MarketTicker quotes={tickerQuotes} />
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
        <nav className="text-sm text-ink-muted">
          <Link href="/dashboard" className="hover:text-ink">
            แดชบอร์ด
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">ข้อมูลร้าน</span>
        </nav>

        <h1 className="mt-2 text-3xl font-bold text-ink">
          ข้อมูลร้านของฉัน
          <span className="block text-base font-normal text-ink-muted">
            Farmer Storefront
          </span>
        </h1>
        {profile?.province ? (
          <p className="mt-1 text-sm text-ink-muted">
            ตั้งอยู่ที่ จังหวัด{profile.province.nameTh}
            {profile.district ? ` · ${profile.district}` : ""}
          </p>
        ) : null}

        <Card className="mt-6 p-5 md:p-6">
          <ShopEditor
            shop={{
              shopName: profile?.shopName ?? null,
              shopDescription: profile?.shopDescription ?? null,
              lineId: profile?.lineId ?? null,
              shopUrl: `/shop/${user.id}`,
            }}
          />
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
