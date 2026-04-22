import { NextResponse } from "next/server";

import type { CompetencyUpsertResponseDto } from "@/lib/competency-types";
import { postCompetencyBodySchema } from "@/lib/competency-validation";
import { dateToYmd, ymdToUtcDate } from "@/lib/competency-utils";
import { parseJsonBody } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_AUDIT_EMP = "PROJMGMT-001";

export async function POST(
  request: Request,
): Promise<
  NextResponse<CompetencyUpsertResponseDto | { error: string }>
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseJsonBody(postCompetencyBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { emp_id, activity_id, level, active_date, expiry_date } = parsed.data;

  const activeDate = ymdToUtcDate(active_date);
  const expiryDate =
    expiry_date === null ? null : ymdToUtcDate(expiry_date);

  const row = await prisma.employeeCompetency.upsert({
    where: {
      employeeId_activityId: {
        employeeId: emp_id,
        activityId: activity_id,
      },
    },
    create: {
      employeeId: emp_id,
      activityId: activity_id,
      level,
      activeDate,
      expiryDate,
      createdById: DEFAULT_AUDIT_EMP,
      updatedById: DEFAULT_AUDIT_EMP,
    },
    update: {
      level,
      activeDate,
      expiryDate,
      updatedById: DEFAULT_AUDIT_EMP,
    },
    select: {
      id: true,
      employeeId: true,
      activityId: true,
      level: true,
      activeDate: true,
      expiryDate: true,
    },
  });

  const competency = {
    competencyId: row.id,
    employeeId: row.employeeId,
    activityId: row.activityId,
    level: row.level,
    activeDate: dateToYmd(row.activeDate),
    expiryDate: row.expiryDate === null ? null : dateToYmd(row.expiryDate),
  };

  return NextResponse.json({ competency });
}
