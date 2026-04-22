import { NextResponse } from "next/server";

import { parseJsonBody } from "@/lib/api-validation";
import { patchSubProjectBodySchema } from "@/lib/project-api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AUDIT = "PROJMGMT-001";

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function wouldCreateCycle(
  subProjectId: number,
  proposedPred: number | null,
  predecessorById: Map<number, number | null>,
): boolean {
  if (proposedPred === null) {
    return false;
  }
  let cur: number | null = proposedPred;
  const seen = new Set<number>();
  while (cur !== null) {
    if (cur === subProjectId) {
      return true;
    }
    if (seen.has(cur)) {
      return true;
    }
    seen.add(cur);
    cur = predecessorById.get(cur) ?? null;
  }
  return false;
}

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

  const parsed = parseJsonBody(patchSubProjectBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const prev = await prisma.subProject.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      status: true,
      baselineStart: true,
      plannedStart: true,
      plannedEnd: true,
      predecessorSubProjectId: true,
    },
  });

  if (!prev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { status, plannedStart, plannedEnd, predecessorSubProjectId } = parsed.data;

  if (predecessorSubProjectId !== undefined && predecessorSubProjectId !== null) {
    const pred = await prisma.subProject.findFirst({
      where: { id: predecessorSubProjectId, projectId: prev.projectId },
      select: { id: true },
    });
    if (!pred) {
      return NextResponse.json({ error: "Invalid predecessor" }, { status: 400 });
    }
  }

  const siblings = await prisma.subProject.findMany({
    where: { projectId: prev.projectId },
    select: { id: true, predecessorSubProjectId: true },
  });
  const predMap = new Map<number, number | null>(
    siblings.map((s) => [s.id, s.predecessorSubProjectId]),
  );
  if (predecessorSubProjectId !== undefined) {
    predMap.set(id, predecessorSubProjectId);
  }

  if (
    wouldCreateCycle(id, predMap.get(id) ?? null, predMap)
  ) {
    return NextResponse.json(
      { error: "Predecessor creates a cycle" },
      { status: 400 },
    );
  }

  const mergedStart =
    plannedStart !== undefined
      ? plannedStart === null
        ? null
        : ymdToDate(plannedStart)
      : prev.plannedStart;
  const mergedEnd =
    plannedEnd !== undefined
      ? plannedEnd === null
        ? null
        : ymdToDate(plannedEnd)
      : prev.plannedEnd;

  const plannedFieldsTouched =
    plannedStart !== undefined || plannedEnd !== undefined;
  const baselineSync =
    plannedFieldsTouched &&
    (mergedStart !== null && mergedEnd !== null
      ? { baselineStart: mergedStart, baselineEnd: mergedEnd }
      : { baselineStart: null, baselineEnd: null });

  await prisma.subProject.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(plannedStart !== undefined
        ? {
            plannedStart:
              plannedStart === null ? null : ymdToDate(plannedStart),
          }
        : {}),
      ...(plannedEnd !== undefined
        ? {
            plannedEnd: plannedEnd === null ? null : ymdToDate(plannedEnd),
          }
        : {}),
      ...(predecessorSubProjectId !== undefined
        ? { predecessorSubProjectId }
        : {}),
      ...(plannedFieldsTouched ? baselineSync : {}),
      updatedById: AUDIT,
    },
  });

  return NextResponse.json({ ok: true });
}
