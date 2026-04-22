import { MilestoneStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { parseJsonBody } from "@/lib/api-validation";
import { patchMilestoneBodySchema } from "@/lib/project-api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AUDIT = "PROJMGMT-001";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseJsonBody(patchMilestoneBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const exists = await prisma.milestone.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name, targetDate, status } = parsed.data;

  await prisma.milestone.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(targetDate !== undefined
        ? { targetDate: new Date(`${targetDate}T12:00:00.000Z`) }
        : {}),
      ...(status !== undefined ? { status: status as MilestoneStatus } : {}),
      updatedById: AUDIT,
    },
  });

  return NextResponse.json({ ok: true });
}
