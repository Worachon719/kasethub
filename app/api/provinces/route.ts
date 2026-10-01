import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/provinces — geography lookup for filters and the geoselector. */
export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get("region") ?? undefined;

    const provinces = await prisma.province.findMany({
      where: region ? { region: region as never } : undefined,
      orderBy: [{ region: "asc" }, { nameTh: "asc" }],
      select: {
        id: true,
        nameTh: true,
        nameEn: true,
        code: true,
        region: true,
        latitude: true,
        longitude: true,
        _count: { select: { lots: true } },
      },
    });

    return NextResponse.json(
      {
        data: provinces.map((p) => ({
          ...p,
          _count: undefined,
          activeLotCount: p._count.lots,
        })),
        meta: { count: provinces.length },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
