export type SeedStageValue = "R&D" | "Production";
export type PrismaStageValue = "RnD" | "Production";

/** Default audit actor for v2 seed rows and historical backfills. */
export const SEED_AUDIT_EMP_ID = "PROJMGMT-001";

export function startOfUtcDayFromDate(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${day}T00:00:00.000Z`);
}

export function addUtcDays(d: Date, days: number): Date {
  const t = new Date(d.getTime());
  t.setUTCDate(t.getUTCDate() + days);
  return t;
}

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

function utcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfUtcDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function isoWeekdayMon1Sun7(d: Date): number {
  const wd = d.getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Monday 00:00 UTC of the ISO week containing `d` (same as dashboard logic). */
export function utcMondayOfWeek(d: Date): Date {
  const day = isoWeekdayMon1Sun7(d);
  const monday = new Date(d.getTime());
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  return startOfUtcDay(utcYmd(monday));
}

/**
 * Maps each seed calendar day into the current ISO week (Mon–Sun UTC) so
 * dashboard scopes like "This Week" include seeded rows regardless of the
 * original year in seed-data (e.g. 2025 vs 2026).
 */
export function mapSeedDateIntoCurrentIsoWeek(
  entryDate: Date,
  minTs: number,
  maxTs: number,
  now: Date = new Date(),
): Date {
  const span = Math.max(1, maxTs - minTs);
  const ratio = (entryDate.getTime() - minTs) / span;
  const dayIndex = Math.min(6, Math.floor(ratio * 7));
  const monday = utcMondayOfWeek(now);
  return new Date(monday.getTime() + dayIndex * 86400000);
}

/**
 * After ISO-week mapping, the two latest seed days can land on Sat/Sun of the
 * current week (e.g. Apr 18–19). Shift those to Mon/Tue of the same week
 * (Apr 11–12) so demo data stays on weekdays.
 */
export function adjustMappedAprEntryDate(entryDate: Date): Date {
  const y = entryDate.getUTCFullYear();
  const m = entryDate.getUTCMonth() + 1;
  const day = entryDate.getUTCDate();
  if (m === 4 && day === 18) {
    return new Date(`${y}-04-11T00:00:00.000Z`);
  }
  if (m === 4 && day === 19) {
    return new Date(`${y}-04-12T00:00:00.000Z`);
  }
  return entryDate;
}

export function toStageValue(value: SeedStageValue): PrismaStageValue {
  return value === "R&D" ? "RnD" : "Production";
}
