import { NextResponse } from "next/server";

import type { EmployeeDto } from "@/lib/api-dtos";
import { deptIdQuerySchema, parseSearchParams } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
): Promise<NextResponse<{ employees: EmployeeDto[] } | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(deptIdQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { deptId } = parsed.data;
  const employees = await prisma.employee.findMany({
    where: { departmentId: deptId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      empId: true,
      empCode: true,
      firstName: true,
      lastName: true,
      shiftId: true,
    },
  });

  return NextResponse.json({ employees });
}
