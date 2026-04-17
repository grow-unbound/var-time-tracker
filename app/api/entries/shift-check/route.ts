import { NextResponse } from "next/server";

import type { ShiftCheckResponse } from "@/lib/api-dtos";
import { parseSearchParams, shiftCheckQuerySchema } from "@/lib/api-validation";
import { entryDateRangeUtc } from "@/lib/entry-date";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
): Promise<NextResponse<ShiftCheckResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(shiftCheckQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { empId, date } = parsed.data;
  const { start, end } = entryDateRangeUtc(date);

  const existing = await prisma.timeEntry.findFirst({
    where: {
      employeeId: empId,
      entryDate: { gte: start, lte: end },
    },
    select: { shiftId: true },
    orderBy: { id: "asc" },
  });

  if (!existing) {
    return NextResponse.json({ locked: false });
  }

  return NextResponse.json({
    locked: true,
    shiftId: existing.shiftId,
  });
}
