import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { TimeEntryStage } from "@prisma/client";

import type { EntriesListResponse, TimeEntryListItemDto } from "@/lib/api-dtos";
import {
  entriesListQuerySchema,
  entriesListSortFieldSchema,
  parseJsonBody,
  parseSearchParams,
  postEntriesBodySchema,
} from "@/lib/api-validation";
import type { TimeScope } from "@/lib/dashboard-date-range";
import { getTimeScopeDateRange } from "@/lib/dashboard-date-range";
import { entryDateFromYmd, entryDateRangeUtc } from "@/lib/entry-date";
import { prisma } from "@/lib/prisma";

export interface PostEntriesSuccess {
  ok: true;
  created: number;
}

function buildEntriesSearchWhere(q: string): Prisma.TimeEntryWhereInput {
  const lower = q.toLowerCase();
  const stageClauses: Prisma.TimeEntryWhereInput[] = [];
  if (lower.includes("production")) {
    stageClauses.push({ stage: TimeEntryStage.Production });
  }
  if (lower.includes("r&d") || /\brnd\b/.test(lower)) {
    stageClauses.push({ stage: TimeEntryStage.RnD });
  }

  return {
    OR: [
      { employee: { firstName: { contains: q } } },
      { employee: { lastName: { contains: q } } },
      { employee: { empCode: { contains: q } } },
      { employee: { department: { name: { contains: q } } } },
      { project: { name: { contains: q } } },
      { project: { projectCode: { contains: q } } },
      { battery: { modelName: { contains: q } } },
      { lot: { lotNumber: { contains: q } } },
      { activity: { name: { contains: q } } },
      ...stageClauses,
    ],
  };
}

function entriesOrderBy(
  sortBy: z.infer<typeof entriesListSortFieldSchema> | undefined,
  sortDir: "asc" | "desc",
): Prisma.TimeEntryOrderByWithRelationInput[] {
  if (!sortBy) {
    return [{ createdAt: "desc" }, { id: "desc" }];
  }
  switch (sortBy) {
    case "date":
      return [{ entryDate: sortDir }, { id: sortDir }];
    case "employee":
      return [
        { employee: { lastName: sortDir } },
        { employee: { firstName: sortDir } },
        { id: sortDir },
      ];
    case "department":
      return [
        { employee: { department: { name: sortDir } } },
        { id: sortDir },
      ];
    case "project":
      return [{ project: { name: sortDir } }, { id: sortDir }];
    case "battery":
      return [{ battery: { modelName: sortDir } }, { id: sortDir }];
    case "lot":
      return [{ lot: { lotNumber: sortDir } }, { id: sortDir }];
    case "stage":
      return [{ stage: sortDir }, { id: sortDir }];
    case "activity":
      return [{ activity: { name: sortDir } }, { id: sortDir }];
    case "duration":
      return [{ durationMinutes: sortDir }, { id: sortDir }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

function buildEntryDateWhereFromScope(
  scope: TimeScope,
): Prisma.TimeEntryWhereInput | undefined {
  const range = getTimeScopeDateRange(scope);
  if (!range) {
    return undefined;
  }
  return { entryDate: { gte: range.start, lte: range.end } };
}

function combineEntriesWhere(input: {
  q: string | undefined;
  scope: TimeScope;
  deptIds: number[] | undefined;
  projectIds: number[] | undefined;
  batteryIds: number[] | undefined;
}): Prisma.TimeEntryWhereInput | undefined {
  const parts: Prisma.TimeEntryWhereInput[] = [];
  if (input.q) {
    parts.push(buildEntriesSearchWhere(input.q));
  }
  const datePart = buildEntryDateWhereFromScope(input.scope);
  if (datePart) {
    parts.push(datePart);
  }
  if (input.deptIds?.length) {
    parts.push({ employee: { departmentId: { in: input.deptIds } } });
  }
  if (input.projectIds?.length) {
    parts.push({ projectId: { in: input.projectIds } });
  }
  if (input.batteryIds?.length) {
    parts.push({ batteryId: { in: input.batteryIds } });
  }
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return { AND: parts };
}

function toListItemDto(row: {
  id: number;
  entryDate: Date;
  createdAt: Date;
  stage: TimeEntryStage;
  durationMinutes: number;
  employee: {
    firstName: string;
    lastName: string;
    department: { name: string };
  };
  project: { name: string };
  battery: { modelName: string };
  lot: { lotNumber: string } | null;
  activity: { name: string };
}): TimeEntryListItemDto {
  const stageDto: TimeEntryListItemDto["stage"] =
    row.stage === TimeEntryStage.RnD ? "RnD" : "Production";
  return {
    id: row.id,
    entryDate: row.entryDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    employeeLabel: `${row.employee.firstName} ${row.employee.lastName}`,
    departmentName: row.employee.department.name,
    projectName: row.project.name,
    batteryModelName: row.battery.modelName,
    lotNumber: row.lot?.lotNumber ?? null,
    stage: stageDto,
    activityName: row.activity.name,
    durationMinutes: row.durationMinutes,
  };
}

export async function GET(
  request: Request,
): Promise<
  NextResponse<EntriesListResponse | { error: string }>
> {
  const { searchParams } = new URL(request.url);
  const parsed = parseSearchParams(entriesListQuerySchema, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const {
    page,
    limit,
    q,
    sortBy,
    sortDir,
    scope,
    depts,
    projects,
    batteries,
  } = parsed.data;
  const where = combineEntriesWhere({
    q,
    scope,
    deptIds: depts,
    projectIds: projects,
    batteryIds: batteries,
  });
  const orderBy = entriesOrderBy(sortBy, sortDir);
  const skip = (page - 1) * limit;

  try {
    const [rows, total, agg] = await prisma.$transaction([
      prisma.timeEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          entryDate: true,
          createdAt: true,
          stage: true,
          durationMinutes: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
          project: { select: { name: true } },
          battery: { select: { modelName: true } },
          lot: { select: { lotNumber: true } },
          activity: { select: { name: true } },
        },
      }),
      prisma.timeEntry.count({ where }),
      prisma.timeEntry.aggregate({
        where,
        _max: { createdAt: true },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const body: EntriesListResponse = {
      entries: rows.map(toListItemDto),
      page,
      limit,
      total,
      totalPages,
      lastEntryAt: agg._max.createdAt?.toISOString() ?? null,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load entries" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<
  NextResponse<
    PostEntriesSuccess | { error: string }
  >
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseJsonBody(postEntriesBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { employeeId, entryDate, shiftId, entries } = parsed.data;
  const totalMinutes = entries.reduce((sum, row) => sum + row.durationMinutes, 0);
  if (totalMinutes > 480) {
    return NextResponse.json(
      { error: "Total duration exceeds 480 minutes for this shift" },
      { status: 400 },
    );
  }

  const entryDateValue = entryDateFromYmd(entryDate);
  const { start, end } = entryDateRangeUtc(entryDate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { empId: employeeId },
        select: {
          empId: true,
          departmentId: true,
          shiftId: true,
        },
      });

      if (!employee) {
        throw new Error("Employee not found");
      }

      const existing = await tx.timeEntry.findFirst({
        where: {
          employeeId,
          entryDate: { gte: start, lte: end },
        },
        select: { shiftId: true },
        orderBy: { id: "asc" },
      });

      if (existing) {
        if (shiftId !== existing.shiftId) {
          throw new Error(
            "Shift must match existing entries for this employee and date",
          );
        }
      } else if (shiftId !== employee.shiftId) {
        throw new Error("Shift must match the employee's assigned shift");
      }

      for (const row of entries) {
        if (row.stage === "Production" && row.lotId === null) {
          throw new Error("Production entries require a lot");
        }
        if (row.stage === "RnD" && row.lotId !== null) {
          throw new Error("R&D entries must not include a lot");
        }

        const activity = await tx.activity.findUnique({
          where: { id: row.activityId },
          select: { departmentId: true },
        });
        if (!activity || activity.departmentId !== employee.departmentId) {
          throw new Error("Activity does not belong to employee department");
        }

        const battery = await tx.batteryModel.findUnique({
          where: { id: row.batteryId },
          select: { projectId: true },
        });
        if (!battery || battery.projectId !== row.projectId) {
          throw new Error("Battery model does not match project");
        }

        const project = await tx.project.findUnique({
          where: { id: row.projectId },
          select: { status: true },
        });
        if (!project || project.status !== "active") {
          throw new Error("Project is not active");
        }

        if (row.lotId !== null) {
          const lot = await tx.lot.findUnique({
            where: { id: row.lotId },
            select: { batteryId: true, projectId: true },
          });
          if (
            !lot ||
            lot.batteryId !== row.batteryId ||
            lot.projectId !== row.projectId
          ) {
            throw new Error("Lot does not match battery and project");
          }
        }
      }

      const stageMap: Record<string, TimeEntryStage> = {
        RnD: TimeEntryStage.RnD,
        Production: TimeEntryStage.Production,
      };

      await tx.timeEntry.createMany({
        data: entries.map((row) => ({
          employeeId,
          entryDate: entryDateValue,
          shiftId,
          activityId: row.activityId,
          projectId: row.projectId,
          batteryId: row.batteryId,
          lotId: row.lotId,
          stage: stageMap[row.stage],
          durationMinutes: row.durationMinutes,
        })),
      });

      return entries.length;
    });

    return NextResponse.json({ ok: true, created: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save entries";
    if (
      message === "Employee not found" ||
      message.startsWith("Shift must") ||
      message.startsWith("Production entries") ||
      message.startsWith("R&D entries") ||
      message.startsWith("Activity does not") ||
      message.startsWith("Battery model") ||
      message.startsWith("Project is not") ||
      message.startsWith("Lot does not")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to save entries" }, { status: 500 });
  }
}
