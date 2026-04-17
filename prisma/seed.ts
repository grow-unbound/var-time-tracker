import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  PrismaClient,
  ProjectStatus,
  type Prisma,
  TimeEntryStage,
} from "@prisma/client";

import {
  activitySeeds,
  batteryModelSeeds,
  departmentSeeds,
  employeeSeeds,
  lotSeeds,
  projectSeeds,
  shiftSeeds,
  timeEntrySeeds,
} from "./seed-data";
import {
  adjustMappedAprEntryDate,
  createActivityLookupKey,
  createBatteryLookupKey,
  createLotLookupKey,
  mapSeedDateIntoCurrentIsoWeek,
  parseSeedDate,
  toStageValue,
} from "./seed-helpers";

const runtimeDatabaseUrl =
  process.env.DATABASE_URL ?? "file:./prisma/var_tracker.db";

const adapter = new PrismaBetterSqlite3({
  url: runtimeDatabaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});
const DEFAULT_LOT_QUANTITY = 1;

function expectDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.timeEntry.deleteMany();
    await tx.lot.deleteMany();
    await tx.batteryModel.deleteMany();
    await tx.activity.deleteMany();
    await tx.employee.deleteMany();
    await tx.project.deleteMany();
    await tx.shift.deleteMany();
    await tx.department.deleteMany();

    await tx.department.createMany({
      data: departmentSeeds.map((department) => ({
        deptCode: department.dept_code,
        name: department.name,
      })),
    });

    await tx.shift.createMany({
      data: shiftSeeds.map((shift) => ({
        name: shift.shift_name,
      })),
    });

    const departments = await tx.department.findMany();
    const shifts = await tx.shift.findMany();

    const departmentIdByName = new Map<string, number>(
      departments.map((department) => [department.name, department.id]),
    );
    const shiftIdByName = new Map<string, number>(
      shifts.map((shift) => [shift.name, shift.id]),
    );

    await tx.activity.createMany({
      data: activitySeeds.map((activity) => ({
        name: activity.activity_name,
        departmentId: expectDefined(
          departmentIdByName.get(activity.department),
          `Missing department for activity: ${activity.department}`,
        ),
      })),
    });

    await tx.project.createMany({
      data: projectSeeds.map((project) => ({
        name: project.name,
        projectCode: project.project_code,
        status: project.status as ProjectStatus,
      })),
    });

    const projects = await tx.project.findMany();
    const projectIdByCode = new Map<string, number>(
      projects.map((project) => [project.projectCode, project.id]),
    );

    await tx.batteryModel.createMany({
      data: batteryModelSeeds.map((batteryModel) => ({
        modelName: batteryModel.model_name,
        projectId: expectDefined(
          projectIdByCode.get(batteryModel.project_code),
          `Missing project for battery model: ${batteryModel.project_code}`,
        ),
      })),
    });

    const batteryModels = await tx.batteryModel.findMany({
      include: {
        project: true,
      },
    });

    const batteryIdByKey = new Map<string, number>(
      batteryModels.map((batteryModel) => [
        createBatteryLookupKey(
          batteryModel.project.projectCode,
          batteryModel.modelName,
        ),
        batteryModel.id,
      ]),
    );

    await tx.lot.createMany({
      data: lotSeeds.map((lot) => ({
        lotNumber: lot.lot_number,
        batteryId: expectDefined(
          batteryIdByKey.get(
            createBatteryLookupKey(lot.project_code, lot.battery_model),
          ),
          `Missing battery model for lot: ${lot.project_code}/${lot.battery_model}`,
        ),
        projectId: expectDefined(
          projectIdByCode.get(lot.project_code),
          `Missing project for lot: ${lot.project_code}`,
        ),
        quantity: DEFAULT_LOT_QUANTITY,
      })),
    });

    await tx.employee.createMany({
      data: employeeSeeds.map((employee) => ({
        empId: employee.emp_id,
        empCode: employee.emp_id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        departmentId: expectDefined(
          departmentIdByName.get(employee.dept_name),
          `Missing department for employee: ${employee.emp_id}`,
        ),
        shiftId: expectDefined(
          shiftIdByName.get(employee.shift),
          `Missing shift for employee: ${employee.emp_id}`,
        ),
      })),
    });

    const activities = await tx.activity.findMany({
      include: {
        department: true,
      },
    });
    const lots = await tx.lot.findMany({
      include: {
        battery: {
          include: {
            project: true,
          },
        },
      },
    });

    const activityIdByKey = new Map<string, number>(
      activities.map((activity) => [
        createActivityLookupKey(activity.department.name, activity.name),
        activity.id,
      ]),
    );
    const lotIdByKey = new Map<string, number>(
      lots.map((lot) => [
        createLotLookupKey(
          lot.battery.project.projectCode,
          lot.battery.modelName,
          lot.lotNumber,
        ),
        lot.id,
      ]),
    );

    const seedDateTimes = timeEntrySeeds.map((e) => parseSeedDate(e.date).getTime());
    const minSeedTs = Math.min(...seedDateTimes);
    const maxSeedTs = Math.max(...seedDateTimes);

    const timeEntries: Prisma.TimeEntryCreateManyInput[] = timeEntrySeeds.map(
      (entry) => {
        const projectCode = entry.project;
        const batteryLookupKey = createBatteryLookupKey(projectCode, entry.battery);
        const lotId =
          entry.lot.length > 0
            ? expectDefined(
                lotIdByKey.get(
                  createLotLookupKey(projectCode, entry.battery, entry.lot),
                ),
                `Missing lot for time entry ${entry.id}`,
              )
            : null;

        return {
          id: Number(entry.id),
          employeeId: entry.emp_id,
          entryDate: adjustMappedAprEntryDate(
            mapSeedDateIntoCurrentIsoWeek(
              parseSeedDate(entry.date),
              minSeedTs,
              maxSeedTs,
            ),
          ),
          shiftId: expectDefined(
            shiftIdByName.get(entry.shift),
            `Missing shift for time entry ${entry.id}`,
          ),
          activityId: expectDefined(
            activityIdByKey.get(createActivityLookupKey(entry.dept, entry.activity)),
            `Missing activity for time entry ${entry.id}`,
          ),
          projectId: expectDefined(
            projectIdByCode.get(projectCode),
            `Missing project for time entry ${entry.id}`,
          ),
          batteryId: expectDefined(
            batteryIdByKey.get(batteryLookupKey),
            `Missing battery model for time entry ${entry.id}`,
          ),
          lotId,
          stage:
            toStageValue(entry.stage) === "RnD"
              ? TimeEntryStage.RnD
              : TimeEntryStage.Production,
          durationMinutes: Number(entry.duration_min),
        };
      },
    );

    await tx.timeEntry.createMany({
      data: timeEntries,
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
