import { NextResponse } from "next/server";

import type { DepartmentDto } from "@/lib/api-dtos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<{ departments: DepartmentDto[] }>> {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      deptCode: true,
      name: true,
    },
  });

  return NextResponse.json({ departments });
}
