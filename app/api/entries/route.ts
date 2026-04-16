import { NextResponse } from "next/server";
import { TimeEntryStage } from "@prisma/client";

import {
  parseJsonBody,
  postEntriesBodySchema,
} from "@/lib/api-validation";
import { entryDateFromYmd, entryDateRangeUtc } from "@/lib/entry-date";
import { prisma } from "@/lib/prisma";

export interface PostEntriesSuccess {
  ok: true;
  created: number;
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
