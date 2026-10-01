import { z } from "zod";
import { NextRequest } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The public half of a grower profile.
 *
 * The `select` is the security boundary, not a convenience. A storefront is
 * public and unauthenticated, so anything not named here cannot leak by
 * accident — in particular `phone`, `email` and `whatsapp` are never returned.
 * Contact runs through LINE (lineId) and the deal room, both of which put a
 * human decision in the loop.
 */
const publicShopSelect = {
  id: true,
  nameTh: true,
  shopName: true,
  shopDescription: true,
  // Only rendered as the "ติดต่อทาง LINE" button when set, so its presence is
  // itself public information the grower opted into by filling it in.
  lineId: true,
  avatarUrl: true,
  verification: true,
  ratingAvg: true,
  ratingCount: true,
  dealCount: true,
  province: { select: { id: true, nameTh: true, nameEn: true, region: true } },
} as const;

/** GET /api/shop?id=… — the public storefront payload for one grower. */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return fail("ต้องระบุ id ของร้าน", 422);

    const user = await prisma.user.findUnique({
      where: { id },
      select: publicShopSelect,
    });
    if (!user) return fail("ไม่พบร้านนี้", 404);

    return ok(user);
  } catch (error) {
    return handleRouteError(error);
  }
}

const updateShopSchema = z.object({
  shopName: z
    .string()
    .trim()
    .max(80, "ชื่อร้านยาวเกิน 80 ตัวอักษร")
    .min(2, "กรุณากรอกชื่อร้านอย่างน้อย 2 ตัวอักษร")
    // An empty string is how a controlled input reports "the user cleared it",
    // and clearing the shop name is the legitimate way to retire a storefront.
    .or(z.literal("")),
  shopDescription: z
    .string()
    .trim()
    .max(600, "คำแนะนำร้านยาวเกิน 600 ตัวอักษร")
    .or(z.literal("")),
  // LINE ids are the bare handle, e.g. "somchai.k". Storing a full URL or an
  // @-prefixed handle here would produce a broken deep link, so the shape is
  // pinned at the edge instead of being discovered by the user later.
  lineId: z
    .string()
    .trim()
    .max(80)
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "LINE ID ต้องเป็นเฉพาะตัวอักษร ตัวเลข จุด ขีดกลาง และขีดก้าง เช่น somchai.k",
    )
    .or(z.literal(""))
    .optional(),
});

/**
 * PATCH /api/shop — edit the signed-in grower's own storefront.
 *
 * Growers only. A broker has a supplier record at /brokers instead, and a
 * buyer has nothing to publish, so giving either role a shop page would be a
 * page with nothing on it.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole("FARMER", "ADMIN");
    const body = updateShopSchema.parse(await readJson(request));

    // Normalise "" to null so an emptied field actually clears the column.
    // Prisma would reject undefined for a create and silently skip it for an
    // update, which is the wrong behaviour for a "clear this" action.
    const shop = await prisma.user.update({
      where: { id: user.id },
      data: {
        shopName: body.shopName || null,
        shopDescription: body.shopDescription || null,
        ...(body.lineId !== undefined ? { lineId: body.lineId || null } : {}),
      },
      select: { ...publicShopSelect, lineId: true },
    });

    return ok(shop);
  } catch (error) {
    return handleRouteError(error);
  }
}
