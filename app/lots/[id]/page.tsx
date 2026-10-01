import Link from "next/link";
import { notFound } from "next/navigation";
import { EscrowGauge } from "@/components/escrow-gauge";
import { BidBoard, BidForm } from "@/components/lots/bid-panel";
import { LotGallery } from "@/components/lots/lot-gallery";
import { ShopContact } from "@/components/shop/shop-contact";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { GradeBadge, SpoilageBadge, VerifiedBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Countdown } from "@/components/ui/countdown";
import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/lib/categories";
import { currentUser } from "@/lib/session";
import {
  daysUntil,
  formatCountdown,
  formatPricePerKg,
  formatThb,
  formatWeight,
  spoilageLevel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  if (!process.env.DATABASE_URL) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-canvas px-4 py-16 md:px-8">
          <Card className="p-8 text-center">
            <p className="font-semibold text-ink">ยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
            <p className="mt-1 text-sm text-ink-muted">
              ตั้งค่า <code className="rounded bg-surface-2 px-1">DATABASE_URL</code>{" "}
              ใน <code className="rounded bg-surface-2 px-1">.env.local</code>{" "}
              เพื่อดูรายละเอียดล็อต
            </p>
          </Card>
        </main>
        <SiteFooter />
      </>
    );
  }

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      // sortOrder is the cover ranking set by the /sell form ("make cover"),
      // so it is the only ordering any reader should rely on.
      images: { orderBy: { sortOrder: "asc" } },
      province: true,
      farmer: {
        select: {
          id: true,
          nameTh: true,
          nameEn: true,
          avatarUrl: true,
          verification: true,
          ratingAvg: true,
          ratingCount: true,
          dealCount: true,
          shopName: true,
          // Public by the grower's own choice, and only ever rendered as the
          // "ติดต่อทาง LINE" button. `whatsapp` is a phone number and is
          // deliberately not selected — it must not reach a public payload.
          lineId: true,
        },
      },
      bids: {
        orderBy: [{ status: "desc" }, { pricePerKg: "desc" }],
        take: 15,
        include: {
          bidder: { select: { id: true, nameTh: true, verification: true } },
          _count: { select: { messages: true } },
        },
      },
      _count: { select: { bids: true, orders: true } },
    },
  });

  if (!lot) notFound();

  const level = spoilageLevel(lot.expiresAt);
  const days = lot.expiresAt ? daysUntil(lot.expiresAt) : null;
  const isOwner = Boolean(user && lot.farmerId === user.id);
  const canBid = Boolean(user && !isOwner && lot.status === "ACTIVE");

  // Bids are the negotiation handle: /deals/:id accepts a bid id, so the board
  // can link straight into the room where the deal gets settled.
  const openBids = lot.bids.filter((b) => b.status === "PENDING");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
        <nav className="mb-4 text-sm text-ink-muted">
          <Link href="/market" className="hover:text-ink">
            ตลาด
          </Link>
          <span className="mx-2">/</span>
          <span className="tabular text-ink">{lot.lotCode}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Images + spec */}
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <LotGallery
                images={lot.images.map((i) => ({
                  id: i.id,
                  url: i.url,
                  altTh: i.altTh,
                }))}
                titleTh={lot.titleTh}
              />
            </Card>

            <Card>
              <CardHeader
                title={
                  <span>
                    {lot.titleTh}
                    <span className="block text-sm font-normal text-ink-muted">
                      {lot.titleEn}
                      {lot.variety ? ` · ${lot.variety}` : ""}
                    </span>
                  </span>
                }
                action={<GradeBadge grade={lot.grade} />}
              />
              <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-4">
                <Spec label="ราคาเสนอ" value={formatPricePerKg(lot.askPricePerKg)} />
                <Spec label="เหลือในคลัง" value={formatWeight(lot.availableQtyKg)} />
                <Spec label="ขั้นต่ำ" value={formatWeight(lot.minOrderKg)} />
                <Spec
                  label="ข้อเสนอ"
                  value={`${lot._count.bids} รายการ`}
                />
              </dl>
              <div className="space-y-3 p-4 md:p-6">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-secondary">
                    {categoryLabel(lot.category)}
                  </span>
                  {lot.isSurplus ? (
                    <span className="rounded-full bg-harvest px-2 py-1 text-xs font-bold text-white">
                      สินค้าล้นสวน
                    </span>
                  ) : null}
                  {days !== null ? (
                    <SpoilageBadge level={level} days={days} />
                  ) : null}
                  {lot.organic ? (
                    <span className="rounded-full bg-optimal-bg px-2 py-1 text-xs font-semibold text-optimal-fg">
                      ออร์แกนิก
                    </span>
                  ) : null}
                  {lot.gapCertified ? (
                    <span className="rounded-full bg-optimal-bg px-2 py-1 text-xs font-semibold text-optimal-fg">
                      GAP
                    </span>
                  ) : null}
                  <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-secondary">
                    Cold Chain: {lot.coldChain}
                  </span>
                </div>

                {lot.description ? (
                  <p className="text-sm leading-relaxed text-ink-secondary">
                    {lot.description}
                  </p>
                ) : null}

                {/**
                 * Sets the shipping expectation before the buyer reaches the bid
                 * form. The platform only carries goods between Thai provinces,
                 * so a buyer planning an export should learn it from the listing
                 * rather than after committing to terms.
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
                    — ผลิตภัณฑ์นี้จัดส่งภายในประเทศไทยเท่านั้น
                    {lot.province?.nameTh
                      ? ` จากจังหวัด${lot.province.nameTh}`
                      : ""}
                  </span>
                </p>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <Row label="หมวดหมู่" value={categoryLabel(lot.category)} />
                  <Row
                    label="พิกัดสวน"
                    value={[lot.district, lot.province?.nameTh]
                      .filter(Boolean)
                      .join(" / ") || "ไม่ระบุ"}
                  />
                  <Row
                    label="วันที่เก็บเกี่ยว"
                    value={
                      lot.harvestDate
                        ? lot.harvestDate.toLocaleDateString("th-TH", {
                            dateStyle: "medium",
                          })
                        : "ไม่ระบุ"
                    }
                  />
                  <Row
                    label="หมดอายุ"
                    value={
                      lot.expiresAt
                        ? lot.expiresAt.toLocaleDateString("th-TH", {
                            dateStyle: "medium",
                          })
                        : "ไม่ระบุ"
                    }
                  />
                  <Row label="รหัสล็อต" value={lot.lotCode} mono />
                </dl>
              </div>
            </Card>
          </div>

          {/* Sidebar: farmer, countdown, bid board */}
          <div className="space-y-6">
            {lot.auctionEndsAt ? (
              <Card className="p-4 md:p-6">
                <h2 className="text-lg font-semibold text-ink">ปิดประมูล</h2>
                {/* Server-rendered value paints immediately; the client
                    component keeps it ticking without a round-trip. */}
                <p className="tabular mt-2 text-2xl font-extrabold text-harvest">
                  {formatCountdown(lot.auctionEndsAt)}
                </p>
                <div className="mt-3">
                  <Countdown target={lot.auctionEndsAt.toISOString()} />
                </div>
              </Card>
            ) : null}

            <Card className="p-4 md:p-6">
              <h2 className="text-lg font-semibold text-ink">
                เกษตรกร / Grower
              </h2>
              {lot.farmer ? (
                <div className="mt-3 space-y-2">
                  {/* A storefront makes the grower's name a link, so a buyer
                      can judge the seller across their whole inventory rather
                      than from a single lot. */}
                  <p className="font-semibold text-ink">
                    {lot.farmer.shopName ? (
                      <Link
                        href={`/shop/${lot.farmer.id}`}
                        className="hover:underline"
                      >
                        {lot.farmer.shopName}
                      </Link>
                    ) : (
                      (lot.farmer.nameTh ?? lot.farmer.nameEn)
                    )}
                  </p>
                  {lot.farmer.verification !== "UNVERIFIED" ? (
                    <VerifiedBadge />
                  ) : null}
                  <p className="tabular text-sm text-ink-secondary">
                    ★ {lot.farmer.ratingAvg.toFixed(1)} ·{" "}
                    {lot.farmer.ratingCount} รีวิว · {lot.farmer.dealCount} ดีล
                  </p>

                  {/*
                    Contact runs through LINE only. There used to be a
                    WhatsApp button here built from the grower's `whatsapp`
                    column, which is a phone number — publishing it on a public
                    listing page guarantees spam and harassment, and it is
                    exactly what the deal room exists to avoid. The `select`
                    below no longer requests the column at all, so this is not
                    a rendering choice that could be undone by a stray
                    `lot.farmer.whatsapp` reference: it is not in the payload.
                  */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {lot.farmer.shopName ? (
                      <ButtonLink
                        href={`/shop/${lot.farmer.id}`}
                        variant="neutral"
                        size="sm"
                      >
                        🏪 ดูหน้าร้าน
                      </ButtonLink>
                    ) : null}
                    <ShopContact
                      lineId={lot.farmer.lineId}
                      shopName={lot.farmer.shopName ?? lot.farmer.nameTh ?? "ผู้ขาย"}
                    />
                  </div>

                  <p className="pt-1 text-xs leading-relaxed text-ink-muted">
                    {isOwner
                      ? "ผู้ซื้อติดต่อคุณผ่านห้องเจรจาในระบบ ซึ่งบันทึกการสนทนาไว้ทุกครั้ง"
                      : "ผู้ซื้อติดต่อผู้ขายผ่านห้องเจรจาในระบบ ซึ่งบันทึกการสนทนาไว้ทุกครั้ง เพื่อความปลอดภัยของทั้งสองฝ่าย"}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">
                  ผู้ขายไม่ระบุ / Unverified seller
                </p>
              )}
            </Card>

            {/* Bid form or the call to action */}
            <Card>
              <CardHeader
                title="เสนอราคา / Place Bid"
                subtitle={`เริ่มต้นที่ ${formatPricePerKg(lot.askPricePerKg)}`}
              />
              <div className="p-4 md:p-6">
                {canBid ? (
                  <BidForm
                    lot={{
                      id: lot.id,
                      titleTh: lot.titleTh,
                      askPricePerKg: lot.askPricePerKg,
                      availableQtyKg: lot.availableQtyKg,
                      minOrderKg: lot.minOrderKg,
                    }}
                  />
                ) : isOwner ? (
                  <p className="text-sm text-ink-secondary">
                    นี่คือล็อตของคุณ — จัดการข้อเสนอได้ที่{" "}
                    <Link href="/dashboard" className="font-semibold text-emerald underline">
                      แดชบอร์ดเกษตรกร
                    </Link>
                  </p>
                ) : lot.status !== "ACTIVE" ? (
                  <p className="text-sm text-ink-muted">
                    ล็อตนี้ปิดรับข้อเสนอแล้ว (สถานะ {lot.status})
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-ink-secondary">
                      เข้าสู่ระบบเพื่อยื่นข้อเสนอราคา
                    </p>
                    <ButtonLink
                      href={`/login?callbackUrl=${encodeURIComponent(`/lots/${lot.id}`)}`}
                      variant="transactional"
                      className="w-full"
                    >
                      เข้าสู่ระบบเพื่อเสนอราคา
                    </ButtonLink>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="ข้อเสนอราคา"
                subtitle={
                  openBids[0]
                    ? `สูงสุด ${formatPricePerKg(openBids[0].pricePerKg)}`
                    : "ยังไม่มีข้อเสนอ"
                }
                action={
                  user ? (
                    <Link
                      href="/dashboard"
                      className="text-xs font-semibold text-emerald hover:underline"
                    >
                      ทั้งหมด
                    </Link>
                  ) : null
                }
              />
              <BidBoard
                bids={lot.bids.map((b) => ({
                  id: b.id,
                  pricePerKg: b.pricePerKg,
                  quantityKg: b.quantityKg,
                  status: b.status,
                  createdAt: b.createdAt.toISOString(),
                  lot: { id: lot.id, titleTh: lot.titleTh, lotCode: lot.lotCode },
                  bidder: {
                    id: b.bidder.id,
                    nameTh: b.bidder.nameTh,
                    verification: b.bidder.verification,
                  },
                }))}
                viewerId={user?.id ?? ""}
                isOwner={isOwner}
              />
            </Card>

            <Card className="p-4 md:p-6">
              <h2 className="text-lg font-semibold text-ink">
                สถานะเงินประกัน
                <span className="block text-sm font-normal text-ink-muted">
                  Escrow Trust Gauge
                </span>
              </h2>
              <EscrowGauge current="ESCROW_DEPOSITED" className="mt-3" />
              <p className="mt-3 text-xs text-ink-muted">
                ขั้นตอนจะเดินหน้าเมื่อมีการประมูลสำเร็จ · มูลค่าประมาณ{" "}
                <span className="tabular font-semibold text-ink">
                  {formatThb(
                    Math.round(lot.askPricePerKg * lot.minOrderKg),
                  )}
                </span>
              </p>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`text-ink ${mono ? "tabular font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
