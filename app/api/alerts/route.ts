import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { getAlertMatches } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createWatchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/alerts — a broker's watches and the lots currently matching them.
 *
 * Brokers and buyers only. A farmer has nothing to watch: they are the ones
 * publishing, and pointing them at other farmers' expiring lots would be an
 * invitation to undercut each other, which the platform's own escrow flow
 * exists to make unnecessary.
 */
export async function GET() {
  try {
    const user = await requireRole("BROKER", "BUYER", "ADMIN");

    const [watches, matches] = await Promise.all([
      prisma.brokerWatch.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { province: { select: { id: true, nameTh: true, nameEn: true } } },
      }),
      getAlertMatches(user.id),
    ]);

    return ok({
      watches: watches.map((w) => ({
        id: w.id,
        category: w.category,
        label: w.label,
        minQuantityKg: w.minQuantityKg,
        province: w.province,
        createdAt: w.createdAt.toISOString(),
      })),
      matches,
      meta: { watchCount: watches.length, matchCount: matches.length },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/alerts — save a watch.
 *
 * The category is required, province and quantity floor optional: "tell me
 * about any mango about to spoil" is the common case, and a form that forced
 * both optionals would be mostly busywork.
 */
export async function POST(request: Request) {
  try {
    const user = await requireRole("BROKER", "BUYER", "ADMIN");
    const body = createWatchSchema.parse(await readJson(request));

    // A province id that is not a real Thai province would create a watch that
    // can never match anything, which is worse than a 422 — the user would see
    // a saved watch and a permanently empty alert list.
    if (body.provinceId) {
      const province = await prisma.province.findUnique({
        where: { id: body.provinceId },
        select: { id: true },
      });
      if (!province) return fail("จังหวัดไม่ถูกต้อง", 422);
    }

    const watch = await prisma.brokerWatch.create({
      data: {
        userId: user.id,
        category: body.category,
        provinceId: body.provinceId ?? null,
        label: body.label,
        minQuantityKg: body.minQuantityKg ?? null,
      },
      include: { province: { select: { id: true, nameTh: true, nameEn: true } } },
    });

    return ok(
      {
        id: watch.id,
        category: watch.category,
        label: watch.label,
        minQuantityKg: watch.minQuantityKg,
        province: watch.province,
        createdAt: watch.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * DELETE /api/alerts?id=… — stop watching.
 *
 * Scoped by userId rather than trusting the id alone, so one broker cannot
 * delete another's watch by guessing a cuid.
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireRole("BROKER", "BUYER", "ADMIN");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return fail("ต้องระบุ id ของการเฝ้าดู", 422);

    const existing = await prisma.brokerWatch.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) return fail("ไม่พบการเฝ้าดูนี้", 404);
    if (existing.userId !== user.id) {
      return fail("ลบได้เฉพาะการเฝ้าดูของตัวเองเท่านั้น", 403);
    }

    await prisma.brokerWatch.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
