import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { TimeEntryStage } from "@prisma/client";

import type { DashboardDateRange } from "@/lib/dashboard-date-range";
import { getTimeScopeDateRange, utcTodayRange } from "@/lib/dashboard-date-range";
import type { DashboardResponseDto } from "@/lib/dashboard-types";
import { dashboardQuerySchema } from "@/lib/dashboard-validation";
import { parseSearchParams } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 1000) / 1000;
}

function buildEntryWhere(
  range: DashboardDateRange | null,
  deptIds: number[],
  projectIds: number[],
  batteryIds: number[],
): Prisma.TimeEntryWhereInput {
  return {
    ...(range
      ? { entryDate: { gte: range.start, lte: range.end } }
      : {}),
    ...(projectIds.length > 0 ? { projectId: { in: projectIds } } : {}),
    ...(batteryIds.length > 0 ? { batteryId: { in: batteryIds } } : {}),
    ...(deptIds.length > 0 ? { employee: { departmentId: { in: deptIds } } }
      : {}),
  };
}

export async function GET(
  request: Request,
): Promise<NextResponse<DashboardResponseDto | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(dashboardQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { scope, depts, projects, batteries } = parsed.data;
  const range = getTimeScopeDateRange(scope);
  const where = buildEntryWhere(range, depts, projects, batteries);

  const todayRange = utcTodayRange();
  const todayWhere = buildEntryWhere(todayRange, depts, projects, batteries);

  const [
    sumAgg,
    projectGroups,
    employeeGroups,
    entriesTodayCount,
    lastEntry,
    primaryGroups,
    empStageGroups,
  ] = await Promise.all([
    prisma.timeEntry.aggregate({
      where,
      _sum: { durationMinutes: true },
    }),
    prisma.timeEntry.groupBy({
      by: ["projectId"],
      where,
      _count: { _all: true },
    }),
    prisma.timeEntry.groupBy({
      by: ["employeeId"],
      where,
      _count: { _all: true },
    }),
    prisma.timeEntry.count({ where: todayWhere }),
    prisma.timeEntry.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.timeEntry.groupBy({
      by: ["projectId", "batteryId", "stage"],
      where,
      _sum: { durationMinutes: true },
    }),
    prisma.timeEntry.groupBy({
      by: ["employeeId", "stage"],
      where,
      _sum: { durationMinutes: true },
    }),
  ]);

  const totalMinutes = sumAgg._sum.durationMinutes ?? 0;
  const projectIdsFromData = new Set(primaryGroups.map((g) => g.projectId));
  const batteryIdsFromData = new Set(primaryGroups.map((g) => g.batteryId));

  const [projectsMeta, batteriesMeta, employeesMeta] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: Array.from(projectIdsFromData) } },
      select: { id: true, name: true },
    }),
    prisma.batteryModel.findMany({
      where: { id: { in: Array.from(batteryIdsFromData) } },
      select: { id: true, modelName: true },
    }),
    prisma.employee.findMany({
      where: {
        empId: {
          in: Array.from(
            new Set(empStageGroups.map((g) => g.employeeId)),
          ),
        },
      },
      select: {
        empId: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
    }),
  ]);

  const projectNameById = new Map(projectsMeta.map((p) => [p.id, p.name]));
  const batteryNameById = new Map(
    batteriesMeta.map((b) => [b.id, b.modelName]),
  );

  const primary = primaryGroups
    .map((g) => {
      const minutes = g._sum.durationMinutes ?? 0;
      return {
        projectId: g.projectId,
        projectName: projectNameById.get(g.projectId) ?? `Project ${g.projectId}`,
        batteryId: g.batteryId,
        batteryName:
          batteryNameById.get(g.batteryId) ?? `Battery ${g.batteryId}`,
        stage: g.stage,
        hours: minutesToHours(minutes),
      };
    })
    .filter((row) => row.hours > 0);

  const empById = new Map(employeesMeta.map((e) => [e.empId, e]));

  const empMinutes = new Map<
    string,
    { rnd: number; production: number }
  >();
  for (const g of empStageGroups) {
    const m = g._sum.durationMinutes ?? 0;
    const cur = empMinutes.get(g.employeeId) ?? { rnd: 0, production: 0 };
    if (g.stage === TimeEntryStage.RnD) {
      cur.rnd += m;
    } else {
      cur.production += m;
    }
    empMinutes.set(g.employeeId, cur);
  }

  const byEmployee = Array.from(empMinutes.entries())
    .map(([employeeId, mins]) => {
      const emp = empById.get(employeeId);
      const displayName = emp
        ? `${emp.firstName} ${emp.lastName}`
        : employeeId;
      return {
        employeeId,
        displayName,
        rndHours: minutesToHours(mins.rnd),
        productionHours: minutesToHours(mins.production),
      };
    })
    .filter((r) => r.rndHours > 0 || r.productionHours > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const deptMinutes = new Map<
    number,
    { name: string; rnd: number; production: number }
  >();
  for (const [empId, mins] of Array.from(empMinutes.entries())) {
    const emp = empById.get(empId);
    if (!emp) {
      continue;
    }
    const deptId = emp.departmentId;
    const cur = deptMinutes.get(deptId) ?? {
      name: emp.department.name,
      rnd: 0,
      production: 0,
    };
    cur.rnd += mins.rnd;
    cur.production += mins.production;
    cur.name = emp.department.name;
    deptMinutes.set(deptId, cur);
  }

  const byDepartment = Array.from(deptMinutes.entries())
    .map(([departmentId, v]) => ({
      departmentId,
      departmentName: v.name,
      rndHours: minutesToHours(v.rnd),
      productionHours: minutesToHours(v.production),
    }))
    .filter((r) => r.rndHours > 0 || r.productionHours > 0)
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));

  const body: DashboardResponseDto = {
    metrics: {
      totalHours: minutesToHours(totalMinutes),
      activeProjects: projectGroups.length,
      employeesLogged: employeeGroups.length,
      entriesToday: entriesTodayCount,
      lastEntryAt: lastEntry?.createdAt.toISOString() ?? null,
    },
    primary,
    secondary: {
      byDepartment,
      byEmployee,
    },
  };

  return NextResponse.json(body);
}
