import { NextResponse } from "next/server";

import type { ShiftDto } from "@/lib/api-dtos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<{ shifts: ShiftDto[] }>> {
  const shifts = await prisma.shift.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ shifts });
}
