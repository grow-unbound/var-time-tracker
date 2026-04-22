import { ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import type {
  ProjectsTimelineResponse,
  TimelineMilestoneDto,
  TimelineProjectDto,
  TimelineSubProjectDto,
} from "@/lib/api-dtos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function toYmd(d: Date | null): string | null {
  if (!d) {
    return null;
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(): Promise<NextResponse<ProjectsTimelineResponse>> {
  const projects = await prisma.project.findMany({
    where: { status: ProjectStatus.active },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      projectCode: true,
      colorKey: true,
      subProjects: {
        orderBy: { department: { name: "asc" } },
        select: {
          id: true,
          projectId: true,
          departmentId: true,
          name: true,
          status: true,
          plannedStart: true,
          plannedEnd: true,
          baselineStart: true,
          baselineEnd: true,
          actualStart: true,
          actualEnd: true,
          predecessorSubProjectId: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  const minutesRows = await prisma.$queryRaw<Array<{ sub_project_id: number; minutes: number }>>`
    SELECT sp.sub_project_id,
      COALESCE(
        SUM(
          CASE
            WHEN a.dept_id = sp.dept_id THEN te.duration_minutes
            ELSE 0
          END
        ),
        0
      )::int AS minutes
    FROM sub_projects sp
    LEFT JOIN time_entries te ON te.project_id = sp.project_id
    LEFT JOIN activities a ON te.activity_id = a.activity_id
    GROUP BY sp.sub_project_id
  `;

  const minutesBySubId = new Map<number, number>(
    minutesRows.map((r) => [r.sub_project_id, r.minutes]),
  );

  const projectIds = projects.map((p) => p.id);
  const subIds = projects.flatMap((p) => p.subProjects.map((s) => s.id));

  const milestonesRaw = await prisma.milestone.findMany({
    where: {
      OR: [
        { projectId: { in: projectIds } },
        { subProjectId: { in: subIds } },
      ],
    },
    orderBy: [{ targetDate: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      targetDate: true,
      projectId: true,
      subProjectId: true,
      status: true,
    },
  });

  const milestoneDto = (m: (typeof milestonesRaw)[0]): TimelineMilestoneDto => ({
    id: m.id,
    name: m.name,
    targetDate: toYmd(m.targetDate)!,
    projectId: m.projectId,
    subProjectId: m.subProjectId,
    status: m.status,
  });

  const projectMilestones = new Map<number, TimelineMilestoneDto[]>();
  const subMilestones = new Map<number, TimelineMilestoneDto[]>();

  for (const m of milestonesRaw) {
    const dto = milestoneDto(m);
    if (m.projectId != null) {
      const list = projectMilestones.get(m.projectId) ?? [];
      list.push(dto);
      projectMilestones.set(m.projectId, list);
    }
    if (m.subProjectId != null) {
      const list = subMilestones.get(m.subProjectId) ?? [];
      list.push(dto);
      subMilestones.set(m.subProjectId, list);
    }
  }

  const outProjects: TimelineProjectDto[] = projects.map((p) => {
    const subProjects: TimelineSubProjectDto[] = p.subProjects.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      departmentId: s.departmentId,
      departmentName: s.department.name,
      name: s.name,
      status: s.status,
      plannedStart: toYmd(s.plannedStart),
      plannedEnd: toYmd(s.plannedEnd),
      baselineStart: toYmd(s.baselineStart),
      baselineEnd: toYmd(s.baselineEnd),
      actualStart: toYmd(s.actualStart),
      actualEnd: toYmd(s.actualEnd),
      predecessorSubProjectId: s.predecessorSubProjectId,
      actualMinutes: minutesBySubId.get(s.id) ?? 0,
      milestones: subMilestones.get(s.id) ?? [],
    }));

    return {
      id: p.id,
      name: p.name,
      projectCode: p.projectCode,
      colorKey: p.colorKey,
      subProjects,
      milestones: projectMilestones.get(p.id) ?? [],
    };
  });

  return NextResponse.json({ projects: outProjects });
}
