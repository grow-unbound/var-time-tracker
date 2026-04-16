import { NextResponse } from "next/server";

import type { BatteryDto } from "@/lib/api-dtos";
import { parseSearchParams, projectIdQuerySchema } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
): Promise<NextResponse<{ batteries: BatteryDto[] } | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(projectIdQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { projectId } = parsed.data;
  const batteries = await prisma.batteryModel.findMany({
    where: { projectId },
    orderBy: { modelName: "asc" },
    select: { id: true, modelName: true, projectId: true },
  });

  return NextResponse.json({ batteries });
}
