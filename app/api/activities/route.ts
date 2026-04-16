import { NextResponse } from "next/server";

import type { ActivityDto } from "@/lib/api-dtos";
import { deptIdQuerySchema, parseSearchParams } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
): Promise<NextResponse<{ activities: ActivityDto[] } | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(deptIdQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { deptId } = parsed.data;
  const activities = await prisma.activity.findMany({
    where: { departmentId: deptId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ activities });
}
