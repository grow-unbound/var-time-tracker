import { NextResponse } from "next/server";

import { parseSearchParams, shiftCheckQuerySchema } from "@/lib/api-validation";
import { entryDateRangeUtc } from "@/lib/entry-date";
import { prisma } from "@/lib/prisma";

export interface DayTotalResponse {
  totalMinutes: number;
}

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
): Promise<NextResponse<DayTotalResponse | { error: string }>> {
  const parsed = parseSearchParams(
    shiftCheckQuerySchema,
    new URL(request.url).searchParams,
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }
  const { empId, date } = parsed.data;
  const { start, end } = entryDateRangeUtc(date);

  try {
    const agg = await prisma.timeEntry.aggregate({
      where: {
        employeeId: empId,
        entryDate: { gte: start, lte: end },
      },
      _sum: { durationMinutes: true },
    });

    return NextResponse.json({
      totalMinutes: agg._sum.durationMinutes ?? 0,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load day total" },
      { status: 500 },
    );
  }
}
