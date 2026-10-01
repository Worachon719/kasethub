import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/lib/categories";
import { categorySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/market/prices — ตารางราคาตลาด with 7-day sparklines. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    // Validate rather than cast: an unknown category should 422, not silently
    // return every row.
    const categoryParam = params.get("category");
    const category = categoryParam
      ? categorySchema.parse(categoryParam)
      : undefined;

    const provinceId = params.get("provinceId") ?? undefined;
    const take = Math.min(Number(params.get("perPage") ?? 40) || 40, 100);

    const rows = await prisma.marketPrice.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(provinceId ? { provinceId } : {}),
      },
      orderBy: { recordedAt: "desc" },
      take,
      include: {
        province: {
          select: { id: true, nameTh: true, nameEn: true, region: true },
        },
      },
    });

    return NextResponse.json(
      {
        data: rows.map((r) => ({
          ...r,
          // Denormalised so a client rendering the price table does not have to
          // carry its own copy of the category label map.
          categoryTh: categoryLabel(r.category),
          recordedAt: r.recordedAt.toISOString(),
        })),
        meta: { count: rows.length },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
