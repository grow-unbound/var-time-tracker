import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  parseSearchParams,
  shiftBoardQuerySchema,
} from "@/lib/api-validation";
import type { ShiftBoardResponseDto } from "@/lib/shift-board-dto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function decimalToHoursString(d: Prisma.Decimal): string {
  const n = Number(d);
  if (Number.isNaN(n)) {
    return "0";
  }
  return String(Math.round(n * 100) / 100);
}

export async function GET(
  request: Request,
): Promise<NextResponse<ShiftBoardResponseDto | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(shiftBoardQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { date, shift: shiftId, depts: deptFilter, projects: projectFilter } =
    parsed.data;

  const shiftDate = new Date(`${date}T12:00:00.000Z`);

  const projects = await prisma.project.findMany({
    where: {
      status: "active",
      ...(projectFilter?.length
        ? { id: { in: projectFilter } }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      projectCode: true,
      colorKey: true,
    },
  });

  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0) {
    return NextResponse.json({
      rows: [],
      cols: [],
      cells: [],
      assignments: [],
      qualifications: [],
      shiftDate: date,
      shiftId,
    });
  }

  const activities = await prisma.activity.findMany({
    where: {
      ...(deptFilter?.length
        ? { departmentId: { in: deptFilter } }
        : {}),
    },
    include: {
      department: { select: { id: true, name: true } },
    },
  });

  activities.sort((a, b) => {
    const dn = a.department.name.localeCompare(b.department.name);
    if (dn !== 0) {
      return dn;
    }
    return a.name.localeCompare(b.name);
  });

  const subProjects = await prisma.subProject.findMany({
    where: { projectId: { in: projectIds } },
    select: {
      id: true,
      projectId: true,
      departmentId: true,
      status: true,
    },
  });

  const subByProjectDept = new Map<string, (typeof subProjects)[0]>();
  for (const s of subProjects) {
    subByProjectDept.set(`${s.projectId}-${s.departmentId}`, s);
  }

  const rows = activities.map((a) => ({
    departmentId: a.departmentId,
    departmentName: a.department.name,
    activityId: a.id,
    activityName: a.name,
  }));

  const cols = projects.map((p) => ({
    projectId: p.id,
    projectCode: p.projectCode,
    projectName: p.name,
    colorKey: p.colorKey,
  }));

  const cells: ShiftBoardResponseDto["cells"] = [];
  for (const a of activities) {
    for (const p of projects) {
      const sub = subByProjectDept.get(`${p.id}-${a.departmentId}`);
      const mayNeedCoverage =
        sub != null &&
        sub.status !== "completed" &&
        sub.status !== "on_hold";
      cells.push({
        activityId: a.id,
        projectId: p.id,
        subProjectId: sub?.id ?? null,
        mayNeedCoverage: Boolean(mayNeedCoverage),
      });
    }
  }

  const assignmentsRaw = await prisma.shiftAssignment.findMany({
    where: {
      shiftDate,
      shiftId,
      subProject: { projectId: { in: projectIds } },
    },
    include: {
      employee: {
        select: {
          empId: true,
          firstName: true,
          lastName: true,
          departmentId: true,
        },
      },
      subProject: {
        select: { id: true, projectId: true, departmentId: true },
      },
      activity: {
        select: { id: true, departmentId: true },
      },
    },
  });

  const activityIdSet = new Set(activities.map((a) => a.id));
  const filtered = assignmentsRaw.filter((x) => activityIdSet.has(x.activityId));

  const assignmentCountsByEmp = new Map<string, number>();
  for (const x of filtered) {
    assignmentCountsByEmp.set(
      x.employeeId,
      (assignmentCountsByEmp.get(x.employeeId) ?? 0) + 1,
    );
  }

  const assignments: ShiftBoardResponseDto["assignments"] = filtered
    .map((x) => ({
      assignmentId: x.id,
      empId: x.employee.empId,
      firstName: x.employee.firstName,
      lastName: x.employee.lastName,
      activityId: x.activityId,
      projectId: x.subProject.projectId,
      subProjectId: x.subProjectId,
      departmentId: x.employee.departmentId,
      durationHours: decimalToHoursString(x.duration),
      assignmentCountForEmployee: assignmentCountsByEmp.get(x.employeeId) ?? 0,
    }))
    .sort((a, b) => {
      const fn = a.firstName.localeCompare(b.firstName);
      if (fn !== 0) {
        return fn;
      }
      return a.lastName.localeCompare(b.lastName);
    });

  const competencies = await prisma.employeeCompetency.findMany({
    where: {
      level: { in: [1, 2] },
      activeDate: { lte: shiftDate },
      OR: [{ expiryDate: null }, { expiryDate: { gte: shiftDate } }],
    },
    select: { employeeId: true, activityId: true },
  });

  const qualMap = new Map<string, number[]>();
  for (const c of competencies) {
    const list = qualMap.get(c.employeeId) ?? [];
    list.push(c.activityId);
    qualMap.set(c.employeeId, list);
  }

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(deptFilter?.length
        ? { departmentId: { in: deptFilter } }
        : {}),
    },
    select: {
      empId: true,
      firstName: true,
      lastName: true,
      departmentId: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const activityIdsInBoard = new Set(activities.map((a) => a.id));
  const qualifications: ShiftBoardResponseDto["qualifications"] = employees
    .map((e) => {
      const acts = (qualMap.get(e.empId) ?? []).filter((id) =>
        activityIdsInBoard.has(id),
      );
      return {
        empId: e.empId,
        firstName: e.firstName,
        lastName: e.lastName,
        departmentId: e.departmentId,
        validActivityIds: Array.from(new Set(acts)).sort((a, b) => a - b),
      };
    })
    .filter((q) => q.validActivityIds.length > 0);

  return NextResponse.json({
    rows,
    cols,
    cells,
    assignments,
    qualifications,
    shiftDate: date,
    shiftId,
  });
}
