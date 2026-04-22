import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import type {
  CompetencyMatrixCellDto,
  CompetencyMatrixResponseDto,
  CompetencyStatusToken,
} from "@/lib/competency-types";
import { competencyMatrixQuerySchema } from "@/lib/competency-validation";
import { getCompetencyDateContext } from "@/lib/competency-utils";
import { parseSearchParams } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function statusBranch(
  status: CompetencyStatusToken,
  ctx: ReturnType<typeof getCompetencyDateContext>,
): Prisma.EmployeeWhereInput {
  if (status === "active") {
    return {
      competencies: {
        some: {
          level: { in: [1, 2] },
          OR: [
            { expiryDate: null },
            { expiryDate: { gte: ctx.todayStart } },
          ],
        },
      },
    };
  }
  if (status === "expired") {
    return {
      competencies: {
        some: {
          level: { in: [1, 2] },
          expiryDate: { not: null, lt: ctx.todayStart },
        },
      },
    };
  }
  return {
    competencies: {
      some: {
        level: { in: [1, 2] },
        expiryDate: {
          not: null,
          gte: ctx.todayStart,
          lte: ctx.expiringWindowEnd,
        },
      },
    },
  };
}

function buildStatusesWhere(
  statuses: CompetencyStatusToken[],
  ctx: ReturnType<typeof getCompetencyDateContext>,
): Prisma.EmployeeWhereInput | undefined {
  if (statuses.length === 0) {
    return undefined;
  }
  if (statuses.length === 1) {
    return statusBranch(statuses[0]!, ctx);
  }
  return {
    OR: statuses.map((s) => statusBranch(s, ctx)),
  };
}

function buildEmployeeWhere(
  depts: number[] | undefined,
  activities: number[] | undefined,
  shifts: number[] | undefined,
  statuses: CompetencyStatusToken[],
  q: string | undefined,
  ctx: ReturnType<typeof getCompetencyDateContext>,
): Prisma.EmployeeWhereInput {
  const nameSearch: Prisma.EmployeeWhereInput | undefined = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const deptFilter: Prisma.EmployeeWhereInput | undefined =
    depts && depts.length > 0
      ? { departmentId: { in: depts } }
      : undefined;

  const activityFilter: Prisma.EmployeeWhereInput | undefined =
    activities && activities.length > 0
      ? {
          competencies: {
            some: { activityId: { in: activities } },
          },
        }
      : undefined;

  const shiftFilter: Prisma.EmployeeWhereInput | undefined =
    shifts && shifts.length > 0
      ? { shiftId: { in: shifts } }
      : undefined;

  const statusWhere = buildStatusesWhere(statuses, ctx);

  const parts: Prisma.EmployeeWhereInput[] = [
    { isActive: true },
    ...(deptFilter ? [deptFilter] : []),
    ...(nameSearch ? [nameSearch] : []),
    ...(statusWhere ? [statusWhere] : []),
    ...(activityFilter ? [activityFilter] : []),
    ...(shiftFilter ? [shiftFilter] : []),
  ];

  return { AND: parts };
}

function toCellDto(row: {
  id: number;
  employeeId: string;
  activityId: number;
  level: number | null;
  activeDate: Date;
  expiryDate: Date | null;
}): CompetencyMatrixCellDto {
  const activeY = row.activeDate.toISOString().slice(0, 10);
  const expY =
    row.expiryDate === null ? null : row.expiryDate.toISOString().slice(0, 10);
  return {
    competencyId: row.id,
    employeeId: row.employeeId,
    activityId: row.activityId,
    level: row.level,
    activeDate: activeY,
    expiryDate: expY,
  };
}

export async function GET(
  request: Request,
): Promise<
  NextResponse<CompetencyMatrixResponseDto | { error: string }>
> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(competencyMatrixQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const {
    page,
    limit,
    depts,
    activities: activityIdsFilter,
    shifts: shiftIdsFilter,
    statuses,
    q,
  } = parsed.data;
  const ctx = getCompetencyDateContext();

  const employeeWhere = buildEmployeeWhere(
    depts,
    activityIdsFilter,
    shiftIdsFilter,
    statuses,
    q,
    ctx,
  );

  const [totalWorkers, workersRaw, activitiesRaw, departmentsRaw] =
    await Promise.all([
      prisma.employee.count({ where: employeeWhere }),
      prisma.employee.findMany({
        where: employeeWhere,
        orderBy: [
          { department: { name: "asc" } },
          { lastName: "asc" },
          { firstName: "asc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          empId: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: {
            select: { name: true, deptCode: true },
          },
        },
      }),
      prisma.activity.findMany({
        orderBy: [
          { department: { name: "asc" } },
          { name: "asc" },
        ],
        select: {
          id: true,
          name: true,
          departmentId: true,
        },
      }),
      prisma.department.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          deptCode: true,
        },
      }),
    ]);

  const workerIds = workersRaw.map((w) => w.empId);

  const competencyRows =
    workerIds.length === 0
      ? []
      : await prisma.employeeCompetency.findMany({
          where: { employeeId: { in: workerIds } },
          select: {
            id: true,
            employeeId: true,
            activityId: true,
            level: true,
            activeDate: true,
            expiryDate: true,
          },
        });

  // Optional row filter: hide workers who don't match activity filter meaningfully — already handled in where.
  // Status filter on rows: worker list already filtered.

  const workers = workersRaw.map((w) => ({
    empId: w.empId,
    firstName: w.firstName,
    lastName: w.lastName,
    departmentId: w.departmentId,
    departmentName: w.department.name,
    departmentCode: w.department.deptCode,
  }));

  const activities = activitiesRaw.map((a) => ({
    id: a.id,
    name: a.name,
    departmentId: a.departmentId,
  }));

  const departments = departmentsRaw.map((d) => ({
    id: d.id,
    name: d.name,
    deptCode: d.deptCode,
  }));

  const competencies = competencyRows.map(toCellDto);

  const body: CompetencyMatrixResponseDto = {
    workers,
    activities,
    departments,
    competencies,
    page,
    limit,
    totalWorkers,
  };

  return NextResponse.json(body);
}
