import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { parseJsonBody, postShiftAssignmentBodySchema } from "@/lib/api-validation";
import type { PostShiftAssignmentResponseDto } from "@/lib/shift-board-dto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SEED_AUDIT_EMP_ID = "PROJMGMT-001";
const MAX_SHIFT_HOURS = 8;

function shiftDateValue(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<PostShiftAssignmentResponseDto | { error: string }>
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseJsonBody(postShiftAssignmentBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const {
    emp_id: empId,
    sub_project_id: subProjectId,
    activity_id: activityId,
    shift_date: shiftYmd,
    shift_id: shiftId,
    duration_hours: durationHours,
  } = parsed.data;

  const shiftDate = shiftDateValue(shiftYmd);
  const duration = new Prisma.Decimal(durationHours);

  const [sub, activity, existingDup, comp, existingForEmp, employee] =
    await Promise.all([
      prisma.subProject.findUnique({
        where: { id: subProjectId },
        select: { id: true, projectId: true, departmentId: true },
      }),
      prisma.activity.findUnique({
        where: { id: activityId },
        select: { id: true, departmentId: true },
      }),
      prisma.shiftAssignment.findFirst({
        where: {
          employeeId: empId,
          subProjectId,
          activityId,
          shiftDate,
          shiftId,
        },
        select: { id: true },
      }),
      prisma.employeeCompetency.findFirst({
        where: {
          employeeId: empId,
          activityId,
          level: { in: [1, 2] },
          activeDate: { lte: shiftDate },
          OR: [{ expiryDate: null }, { expiryDate: { gte: shiftDate } }],
        },
      }),
      prisma.shiftAssignment.findMany({
        where: { employeeId: empId, shiftDate, shiftId },
        select: { duration: true },
      }),
      prisma.employee.findUnique({
        where: { empId },
        select: { empId: true, departmentId: true, isActive: true },
      }),
    ]);

  if (!sub) {
    return NextResponse.json(
      { error: "sub_project not found" },
      { status: 400 },
    );
  }
  if (!activity) {
    return NextResponse.json({ error: "activity not found" }, { status: 400 });
  }
  if (activity.departmentId !== sub.departmentId) {
    return NextResponse.json(
      { error: "activity does not match sub-project department" },
      { status: 400 },
    );
  }
  if (existingDup) {
    return NextResponse.json(
      { error: "duplicate assignment for this cell" },
      { status: 409 },
    );
  }
  if (!comp) {
    return NextResponse.json(
      { error: "no valid competency for this activity" },
      { status: 400 },
    );
  }
  if (!employee?.isActive) {
    return NextResponse.json(
      { error: "employee not found or inactive" },
      { status: 400 },
    );
  }
  if (employee.departmentId !== sub.departmentId) {
    return NextResponse.json(
      { error: "employee is not in this activity's department" },
      { status: 400 },
    );
  }

  let sumH = 0;
  for (const r of existingForEmp) {
    sumH += Number(r.duration);
  }
  if (sumH + Number(duration) > MAX_SHIFT_HOURS + 1e-6) {
    return NextResponse.json(
      { error: `total assignment hours cannot exceed ${MAX_SHIFT_HOURS} per shift` },
      { status: 400 },
    );
  }

  const created = await prisma.shiftAssignment.create({
    data: {
      employeeId: empId,
      subProjectId,
      activityId,
      shiftDate,
      shiftId,
      duration,
      createdById: SEED_AUDIT_EMP_ID,
      updatedById: SEED_AUDIT_EMP_ID,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, assignment: { id: created.id } });
}
