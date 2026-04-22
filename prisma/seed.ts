import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import {
  Prisma,
  PrismaClient,
  MilestoneStatus,
  ProjectStatus,
  SubProjectStatus,
  TimeEntryStage,
} from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("supabase")
    ? { rejectUnauthorized: false }
    : undefined,
});
const adapter = new PrismaPg(pool);

import {
  activitySeeds,
  batteryModelSeeds,
  departmentSeeds,
  employeeSeeds,
  lotSeeds,
  projectColorKeyByCode,
  projectSeeds,
  shiftSeeds,
  timeEntrySeeds,
} from "./seed-data";
import {
  addUtcDays,
  adjustMappedAprEntryDate,
  createActivityLookupKey,
  createBatteryLookupKey,
  createLotLookupKey,
  mapSeedDateIntoCurrentIsoWeek,
  parseSeedDate,
  SEED_AUDIT_EMP_ID,
  startOfUtcDayFromDate,
  toStageValue,
} from "./seed-helpers";

const prisma = new PrismaClient({ adapter });
const DEFAULT_LOT_QUANTITY = 1;

function expectDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

async function main(): Promise<void> {
  // Sequential statements (no interactive $transaction) — required for Supabase transaction pooler :6543.
  await prisma.shiftAssignment.deleteMany();
  await prisma.employeeCompetency.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.subProject.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.batteryModel.deleteMany();
  await prisma.project.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.department.deleteMany();

  await prisma.department.createMany({
      data: departmentSeeds.map((department) => ({
        deptCode: department.dept_code,
        name: department.name,
      })),
    });

  await prisma.shift.createMany({
      data: shiftSeeds.map((shift) => ({
        name: shift.shift_name,
      })),
    });

    const departments = await prisma.department.findMany();
    const shifts = await prisma.shift.findMany();

    const departmentIdByName = new Map<string, number>(
      departments.map((department) => [department.name, department.id]),
    );
    const shiftIdByName = new Map<string, number>(
      shifts.map((shift) => [shift.name, shift.id]),
    );

    await prisma.employee.createMany({
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

    await prisma.activity.createMany({
      data: activitySeeds.map((activity) => ({
        name: activity.activity_name,
        departmentId: expectDefined(
          departmentIdByName.get(activity.department),
          `Missing department for activity: ${activity.department}`,
        ),
      })),
    });

    await prisma.project.createMany({
      data: projectSeeds.map((project) => ({
        name: project.name,
        projectCode: project.project_code,
        status: project.status as ProjectStatus,
        colorKey:
          projectColorKeyByCode[project.project_code] ?? "navy",
      })),
    });

    const projects = await prisma.project.findMany();
    const projectIdByCode = new Map<string, number>(
      projects.map((project) => [project.projectCode, project.id]),
    );

    await prisma.batteryModel.createMany({
      data: batteryModelSeeds.map((batteryModel) => ({
        modelName: batteryModel.model_name,
        projectId: expectDefined(
          projectIdByCode.get(batteryModel.project_code),
          `Missing project for battery model: ${batteryModel.project_code}`,
        ),
      })),
    });

    const batteryModels = await prisma.batteryModel.findMany({
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

    await prisma.lot.createMany({
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

    const SUBPROJECT_PLANNED_CODES = new Set(["QRSAM", "BAH", "KONKURS"]);
    const subProjectRows: Prisma.SubProjectCreateManyInput[] = [];
    for (const project of projects) {
      for (const dept of departments) {
        let status: SubProjectStatus = SubProjectStatus.not_started;
        if (
          project.projectCode === "QRSAM" &&
          (dept.name === "Production" || dept.name === "Quality")
        ) {
          status = SubProjectStatus.in_progress;
        }
        const anchor = startOfUtcDayFromDate(new Date());
        let plannedStart: Date | undefined;
        let plannedEnd: Date | undefined;
        let baselineStart: Date | undefined;
        let baselineEnd: Date | undefined;
        if (SUBPROJECT_PLANNED_CODES.has(project.projectCode)) {
          plannedStart = anchor;
          plannedEnd = addUtcDays(anchor, 75);
          baselineStart = plannedStart;
          baselineEnd = plannedEnd;
        }
        subProjectRows.push({
          projectId: project.id,
          departmentId: dept.id,
          name: `${project.name} — ${dept.name}`,
          status,
          plannedStart,
          plannedEnd,
          baselineStart,
          baselineEnd,
          createdById: SEED_AUDIT_EMP_ID,
          updatedById: SEED_AUDIT_EMP_ID,
        });
      }
    }
    await prisma.subProject.createMany({ data: subProjectRows });

    const activities = await prisma.activity.findMany({
      include: {
        department: true,
      },
    });
    const lots = await prisma.lot.findMany({
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

    const seniorQualified = new Set([
      "PROD-001",
      "PROD-002",
      "PROD-003",
      "PROD-004",
      "PROD-005",
      "QUAL-001",
      "QUAL-002",
      "DESDEV-001",
      "DESDEV-002",
    ]);

    function competencyPairHash(empId: string, activityId: number): number {
      const s = `${empId}:${activityId}`;
      let h = 0;
      for (let i = 0; i < s.length; i += 1) {
        h = (h * 31 + s.charCodeAt(i)) | 0;
      }
      return Math.abs(h);
    }

    const activityIdsByDept = new Map<number, number[]>();
    for (const a of activities) {
      const list = activityIdsByDept.get(a.departmentId) ?? [];
      list.push(a.id);
      activityIdsByDept.set(a.departmentId, list);
    }
    for (const [, ids] of activityIdsByDept) {
      ids.sort((x, y) => x - y);
    }

    const competencyRows: Prisma.EmployeeCompetencyCreateManyInput[] = [];
    for (const empSeed of employeeSeeds) {
      const deptId = departmentIdByName.get(empSeed.dept_name);
      if (deptId === undefined) {
        continue;
      }
      const deptActivityIds = activityIdsByDept.get(deptId) ?? [];
      if (deptActivityIds.length === 0) {
        continue;
      }

      for (const activityId of deptActivityIds) {
        const h = competencyPairHash(empSeed.emp_id, activityId);
        if (h % 5 === 0) {
          continue;
        }
        let level: number;
        if (h % 17 === 0) {
          level = 0;
        } else if (seniorQualified.has(empSeed.emp_id)) {
          level = h % 3 === 0 ? 2 : 1;
        } else {
          level = 1;
        }
        competencyRows.push({
          employeeId: empSeed.emp_id,
          activityId,
          level,
          activeDate: new Date("2023-06-01T00:00:00.000Z"),
          createdById: SEED_AUDIT_EMP_ID,
          updatedById: SEED_AUDIT_EMP_ID,
        });
      }
    }

    competencyRows.sort((a, b) => {
      const keyA = `${a.employeeId}:${a.activityId}`;
      const keyB = `${b.employeeId}:${b.activityId}`;
      return keyA.localeCompare(keyB);
    });

    const seedToday = startOfUtcDayFromDate(new Date());
    const expiredOn = addUtcDays(seedToday, -10);
    const expiringSoonOn = addUtcDays(seedToday, 20);
    for (let i = 0; i < competencyRows.length; i += 1) {
      const row = competencyRows[i];
      if (!row) {
        continue;
      }
      if (i < 2) {
        row.expiryDate = expiredOn;
        row.activeDate = addUtcDays(expiredOn, -365);
      } else if (i < 5) {
        row.expiryDate = expiringSoonOn;
        row.activeDate = addUtcDays(expiringSoonOn, -365);
      } else {
        row.expiryDate = null;
        row.activeDate = new Date("2023-06-01T00:00:00.000Z");
      }
    }

    await prisma.employeeCompetency.createMany({ data: competencyRows });

    const subProjectsWithKeys = await prisma.subProject.findMany({
      include: { project: true, department: true },
    });
    const subProjectIdByCodeAndDept = new Map(
      subProjectsWithKeys.map((sp) => [
        `${sp.project.projectCode}::${sp.department.name}`,
        sp.id,
      ]),
    );

    const firstShiftId = expectDefined(
      shiftIdByName.get("1st Shift"),
      "1st shift id",
    );
    const seedDateTimesForShiftBoard = timeEntrySeeds.map((e) =>
      parseSeedDate(e.date).getTime(),
    );
    const minTsShift = Math.min(...seedDateTimesForShiftBoard);
    const maxTsShift = Math.max(...seedDateTimesForShiftBoard);
    const shiftBoardDate = adjustMappedAprEntryDate(
      mapSeedDateIntoCurrentIsoWeek(
        parseSeedDate("2025-04-16"),
        minTsShift,
        maxTsShift,
      ),
    );

    const qrProdSubId = expectDefined(
      subProjectIdByCodeAndDept.get("QRSAM::Production"),
      "QRSAM production subproject",
    );
    const konkProdSubId = expectDefined(
      subProjectIdByCodeAndDept.get("KONKURS::Production"),
      "KONKURS production subproject",
    );

    const activityIdsByEmployee = new Map<string, number[]>();
    for (const row of competencyRows) {
      const list = activityIdsByEmployee.get(row.employeeId) ?? [];
      list.push(row.activityId);
      activityIdsByEmployee.set(row.employeeId, list);
    }

    const assignedProdIds = [
      "PROD-001",
      "PROD-002",
      "PROD-003",
      "PROD-004",
      "PROD-005",
      "PROD-006",
      "PROD-007",
      "PROD-008",
      "PROD-009",
      "PROD-010",
      "PROD-011",
    ];

    const durationsThree = [
      new Prisma.Decimal("2.25"),
      new Prisma.Decimal("2.50"),
      new Prisma.Decimal("2.75"),
    ];
    const durationsFour = [
      new Prisma.Decimal("2.0"),
      new Prisma.Decimal("2.0"),
      new Prisma.Decimal("2.0"),
      new Prisma.Decimal("1.5"),
    ];

    const shiftAssignmentRows: Prisma.ShiftAssignmentCreateManyInput[] = [];
    let assignIdx = 0;
    for (const empId of assignedProdIds) {
      const acts = expectDefined(
        activityIdsByEmployee.get(empId),
        `competencies for ${empId}`,
      );
      const numRows = assignIdx % 2 === 0 ? 3 : 4;
      const durs = numRows === 3 ? durationsThree : durationsFour;
      for (let r = 0; r < numRows; r += 1) {
        const subId = (assignIdx + r) % 2 === 0 ? qrProdSubId : konkProdSubId;
        const activityId = acts[r % acts.length] ?? acts[0];
        shiftAssignmentRows.push({
          employeeId: empId,
          subProjectId: subId,
          activityId: expectDefined(activityId, "activity id"),
          shiftDate: shiftBoardDate,
          shiftId: firstShiftId,
          duration: expectDefined(durs[r], "shift duration"),
          createdById: SEED_AUDIT_EMP_ID,
          updatedById: SEED_AUDIT_EMP_ID,
        });
      }
      assignIdx += 1;
    }
    await prisma.shiftAssignment.createMany({ data: shiftAssignmentRows });

    const qrsamProjectId = expectDefined(
      projectIdByCode.get("QRSAM"),
      "QRSAM project id",
    );
    const bahProjectId = expectDefined(
      projectIdByCode.get("BAH"),
      "BAH project id",
    );
    const qrQualSubId = expectDefined(
      subProjectIdByCodeAndDept.get("QRSAM::Quality"),
      "QRSAM quality subproject",
    );

    const milestoneRows: Prisma.MilestoneCreateManyInput[] = [
      {
        name: "Design freeze",
        targetDate: addUtcDays(seedToday, -14),
        projectId: qrsamProjectId,
        subProjectId: null,
        status: MilestoneStatus.achieved,
        createdById: SEED_AUDIT_EMP_ID,
        updatedById: SEED_AUDIT_EMP_ID,
      },
      {
        name: "Customer TRR",
        targetDate: addUtcDays(seedToday, 30),
        projectId: qrsamProjectId,
        subProjectId: null,
        status: MilestoneStatus.pending,
        createdById: SEED_AUDIT_EMP_ID,
        updatedById: SEED_AUDIT_EMP_ID,
      },
      {
        name: "BAH pilot build",
        targetDate: addUtcDays(seedToday, 45),
        projectId: bahProjectId,
        subProjectId: null,
        status: MilestoneStatus.pending,
        createdById: SEED_AUDIT_EMP_ID,
        updatedById: SEED_AUDIT_EMP_ID,
      },
      {
        name: "Stack throughput target",
        targetDate: addUtcDays(seedToday, -7),
        projectId: null,
        subProjectId: qrProdSubId,
        status: MilestoneStatus.missed,
        createdById: SEED_AUDIT_EMP_ID,
        updatedById: SEED_AUDIT_EMP_ID,
      },
      {
        name: "QC release gate",
        targetDate: addUtcDays(seedToday, 12),
        projectId: null,
        subProjectId: qrQualSubId,
        status: MilestoneStatus.pending,
        createdById: SEED_AUDIT_EMP_ID,
        updatedById: SEED_AUDIT_EMP_ID,
      },
      {
        name: "First article inspection",
        targetDate: addUtcDays(seedToday, 5),
        projectId: null,
        subProjectId: qrProdSubId,
        status: MilestoneStatus.pending,
        createdById: SEED_AUDIT_EMP_ID,
        updatedById: SEED_AUDIT_EMP_ID,
      },
    ];
    await prisma.milestone.createMany({ data: milestoneRows });

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

  await prisma.timeEntry.createMany({
    data: timeEntries,
  });

  // Explicit IDs in createMany do not advance the SERIAL sequence; fix so new app inserts get unique entry_id.
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('public.time_entries', 'entry_id')::regclass,
      COALESCE((SELECT MAX("entry_id") FROM "time_entries"), 1)
    );
  `);
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
