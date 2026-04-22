import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  parseSearchParams,
  shiftBoardPersonQuerySchema,
} from "@/lib/api-validation";
import type { ShiftBoardPersonResponseDto } from "@/lib/shift-board-dto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function decimalToHoursString(d: Prisma.Decimal): string {
  const n = Number(d);
  if (Number.isNaN(n)) {
    return "0";
  }
  return String(Math.round(n * 100) / 100);
}

function sumDecimalHours(rows: { duration: Prisma.Decimal }[]): string {
  let t = 0;
  for (const r of rows) {
    t += Number(r.duration);
  }
  return String(Math.round(t * 100) / 100);
}

export async function GET(
  request: Request,
): Promise<
  NextResponse<ShiftBoardPersonResponseDto | { error: string }>
> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(shiftBoardPersonQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { date, shift: shiftId, depts: deptFilter, projects: projectFilter } =
    parsed.data;
  const shiftDate = new Date(`${date}T12:00:00.000Z`);

  const projectRows = await prisma.project.findMany({
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

  const cols: ShiftBoardPersonResponseDto["cols"] = projectRows.map((p) => ({
    projectId: p.id,
    projectCode: p.projectCode,
    projectName: p.name,
    colorKey: p.colorKey,
  }));

  const emps = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(deptFilter?.length
        ? { departmentId: { in: deptFilter } }
        : {}),
    },
    include: { department: { select: { name: true } } },
    orderBy: [
      { departmentId: "asc" },
      { firstName: "asc" },
      { lastName: "asc" },
    ],
  });

  const assignRows = await prisma.shiftAssignment.findMany({
    where: { shiftDate, shiftId },
    include: {
      subProject: {
        select: {
          id: true,
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              colorKey: true,
            },
          },
        },
      },
      activity: { select: { id: true, name: true } },
    },
  });

  const byEmp = new Map<string, typeof assignRows>();
  for (const a of assignRows) {
    const list = byEmp.get(a.employeeId) ?? [];
    list.push(a);
    byEmp.set(a.employeeId, list);
  }

  const employees: ShiftBoardPersonResponseDto["employees"] = emps.map(
    (e) => {
      const list = byEmp.get(e.empId) ?? [];
      const totalHours = sumDecimalHours(list);
      const totalNum = Number(totalHours);
      const isUnassigned = !Number.isFinite(totalNum) || totalNum === 0;

      const assignmentDtos = list
        .map((x) => ({
          assignmentId: x.id,
          projectId: x.subProject.project.id,
          projectName: x.subProject.project.name,
          projectCode: x.subProject.project.projectCode,
          colorKey: x.subProject.project.colorKey,
          activityId: x.activityId,
          activityName: x.activity.name,
          subProjectId: x.subProjectId,
          durationHours: decimalToHoursString(x.duration),
        }))
        .sort((a, b) => a.projectName.localeCompare(b.projectName));

      return {
        empId: e.empId,
        firstName: e.firstName,
        lastName: e.lastName,
        departmentId: e.departmentId,
        departmentName: e.department.name,
        totalHours,
        isUnassigned,
        assignments: assignmentDtos,
      };
    },
  );

  return NextResponse.json({
    employees,
    cols,
    shiftDate: date,
    shiftId,
  });
}
