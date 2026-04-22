import { NextResponse } from "next/server";

import type { CompetencyKpisResponseDto } from "@/lib/competency-types";
import {
  getCompetencyDateContext,
  isActiveQualified,
} from "@/lib/competency-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<
  NextResponse<CompetencyKpisResponseDto | { error: string }>
> {
  const ctx = getCompetencyDateContext();

  const [allActivities, competencyRows] = await Promise.all([
    prisma.activity.findMany({ select: { id: true } }),
    prisma.employeeCompetency.findMany({
      select: {
        employeeId: true,
        activityId: true,
        level: true,
        expiryDate: true,
      },
    }),
  ]);

  const qualifiedActiveByActivity = new Map<number, Set<string>>();
  const qualifiedActiveByEmployee = new Map<string, Set<number>>();

  for (const row of competencyRows) {
    const activeQ = isActiveQualified(
      row.level,
      row.expiryDate,
      ctx.todayStart,
    );
    if (activeQ) {
      if (!qualifiedActiveByActivity.has(row.activityId)) {
        qualifiedActiveByActivity.set(row.activityId, new Set());
      }
      qualifiedActiveByActivity.get(row.activityId)!.add(row.employeeId);

      if (!qualifiedActiveByEmployee.has(row.employeeId)) {
        qualifiedActiveByEmployee.set(row.employeeId, new Set());
      }
      qualifiedActiveByEmployee.get(row.employeeId)!.add(row.activityId);
    }
  }

  let lowCoverageActivities = 0;
  for (const { id: aid } of allActivities) {
    const n = qualifiedActiveByActivity.get(aid)?.size ?? 0;
    if (n < 3) {
      lowCoverageActivities += 1;
    }
  }

  let lowSkillWorkers = 0;
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { empId: true },
  });
  for (const e of employees) {
    const n = qualifiedActiveByEmployee.get(e.empId)?.size ?? 0;
    if (n < 3) {
      lowSkillWorkers += 1;
    }
  }

  let expired = 0;
  let expiringSoon = 0;
  for (const row of competencyRows) {
    if (row.expiryDate !== null && row.expiryDate < ctx.todayStart) {
      expired += 1;
    } else if (
      row.expiryDate !== null &&
      row.expiryDate >= ctx.todayStart &&
      row.expiryDate <= ctx.expiringWindowEnd
    ) {
      expiringSoon += 1;
    }
  }

  const body: CompetencyKpisResponseDto = {
    lowCoverageActivities,
    lowSkillWorkers,
    expired,
    expiringSoon,
  };

  return NextResponse.json(body);
}
