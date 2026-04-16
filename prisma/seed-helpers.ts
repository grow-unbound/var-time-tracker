export type SeedStageValue = "R&D" | "Production";
export type PrismaStageValue = "RnD" | "Production";

function normalizeLookupPart(value: string): string {
  return value.trim().toLowerCase();
}

export function createActivityLookupKey(
  departmentName: string,
  activityName: string,
): string {
  return `${normalizeLookupPart(departmentName)}::${normalizeLookupPart(activityName)}`;
}

export function createBatteryLookupKey(
  projectCode: string,
  modelName: string,
): string {
  return `${normalizeLookupPart(projectCode)}::${normalizeLookupPart(modelName)}`;
}

export function createLotLookupKey(
  projectCode: string,
  modelName: string,
  lotNumber: string,
): string {
  return `${createBatteryLookupKey(projectCode, modelName)}::${normalizeLookupPart(lotNumber)}`;
}

export function parseSeedDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toStageValue(value: SeedStageValue): PrismaStageValue {
  return value === "R&D" ? "RnD" : "Production";
}
