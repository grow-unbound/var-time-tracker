import { Prisma, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import type { ProjectDto } from "@/lib/api-dtos";
import { parseJsonBody } from "@/lib/api-validation";
import { pickNextProjectColorKey } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { postProjectBodySchema } from "@/lib/project-api-validation";

export const dynamic = "force-dynamic";

const SEED_AUDIT_EMP_ID = "PROJMGMT-001";

export async function GET(): Promise<NextResponse<{ projects: ProjectDto[] }>> {
  const projects = await prisma.project.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      projectCode: true,
      colorKey: true,
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<{ project: { id: number; projectCode: string } } | { error: string }>
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseJsonBody(postProjectBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { name, projectCode, description, plannedStart, plannedEnd } = parsed.data;

  const usedColors = await prisma.project.findMany({
    where: { status: ProjectStatus.active },
    select: { colorKey: true },
  });
  const colorKey = pickNextProjectColorKey(usedColors.map((p) => p.colorKey));

  try {
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          projectCode,
          description: description ?? null,
          status: ProjectStatus.active,
          colorKey,
          plannedStart: plannedStart
            ? new Date(`${plannedStart}T12:00:00.000Z`)
            : null,
          plannedEnd: plannedEnd
            ? new Date(`${plannedEnd}T12:00:00.000Z`)
            : null,
          createdById: SEED_AUDIT_EMP_ID,
          updatedById: SEED_AUDIT_EMP_ID,
        },
      });

      const departments = await tx.department.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });

      await tx.subProject.createMany({
        data: departments.map((dept) => ({
          projectId: created.id,
          departmentId: dept.id,
          name: `${created.name} — ${dept.name}`,
          createdById: SEED_AUDIT_EMP_ID,
          updatedById: SEED_AUDIT_EMP_ID,
        })),
      });

      return created;
    });

    return NextResponse.json({
      project: { id: project.id, projectCode: project.projectCode },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A project with this code already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
