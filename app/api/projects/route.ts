import { NextResponse } from "next/server";

import type { ProjectDto } from "@/lib/api-dtos";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse<{ projects: ProjectDto[] }>> {
  const projects = await prisma.project.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      projectCode: true,
    },
  });

  return NextResponse.json({ projects });
}
