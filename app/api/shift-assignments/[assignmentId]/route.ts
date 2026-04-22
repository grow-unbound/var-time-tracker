import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { parseJsonBody, patchShiftAssignmentBodySchema } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_SHIFT_H = 8;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { assignmentId: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid assignment id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseJsonBody(patchShiftAssignmentBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }
  const newDuration = new Prisma.Decimal(parsed.data.duration_hours);

  const existing = await prisma.shiftAssignment.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      shiftDate: true,
      shiftId: true,
      duration: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const others = await prisma.shiftAssignment.findMany({
    where: {
      employeeId: existing.employeeId,
      shiftDate: existing.shiftDate,
      shiftId: existing.shiftId,
      id: { not: id },
    },
    select: { duration: true },
  });

  let sumH = 0;
  for (const r of others) {
    sumH += Number(r.duration);
  }
  if (sumH + Number(newDuration) > MAX_SHIFT_H + 1e-6) {
    return NextResponse.json(
      {
        error: `total assignment hours cannot exceed ${MAX_SHIFT_H} per shift`,
      },
      { status: 400 },
    );
  }

  await prisma.shiftAssignment.update({
    where: { id },
    data: { duration: newDuration },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { assignmentId: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid assignment id" }, { status: 400 });
  }

  const existing = await prisma.shiftAssignment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.shiftAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
