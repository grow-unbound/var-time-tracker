import { NextResponse } from "next/server";

import type { LotDto } from "@/lib/api-dtos";
import { batteryIdQuerySchema, parseSearchParams } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
): Promise<NextResponse<{ lots: LotDto[] } | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(batteryIdQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { batteryId } = parsed.data;
  const lots = await prisma.lot.findMany({
    where: { batteryId },
    orderBy: { lotNumber: "asc" },
    select: {
      id: true,
      lotNumber: true,
      batteryId: true,
      projectId: true,
    },
  });

  return NextResponse.json({ lots });
}
