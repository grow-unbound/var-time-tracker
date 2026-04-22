import { MilestoneStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { parseJsonBody } from "@/lib/api-validation";
import { postMilestoneBodySchema } from "@/lib/project-api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AUDIT = "PROJMGMT-001";

export async function POST(
  request: Request,
): Promise<
  NextResponse<{ milestone: { id: number } } | { error: string }>
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseJsonBody(postMilestoneBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { name, targetDate, projectId, subProjectId, status } = parsed.data;

  if (projectId != null) {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!p) {
      return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }
  }
  if (subProjectId != null) {
    const sp = await prisma.subProject.findUnique({
      where: { id: subProjectId },
      select: { id: true },
    });
    if (!sp) {
      return NextResponse.json({ error: "Sub-project not found" }, { status: 400 });
    }
  }

  const created = await prisma.milestone.create({
    data: {
      name,
      targetDate: new Date(`${targetDate}T12:00:00.000Z`),
      projectId,
      subProjectId,
      status: (status ?? "pending") as MilestoneStatus,
      createdById: AUDIT,
      updatedById: AUDIT,
    },
    select: { id: true },
  });

  return NextResponse.json({ milestone: { id: created.id } });
}
