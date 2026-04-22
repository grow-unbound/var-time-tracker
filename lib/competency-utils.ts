import { utcTodayRange } from "@/lib/dashboard-date-range";

/** Level 1 or 2 counts as qualified per product rules. */
export function isQualifiedLevel(level: number | null | undefined): boolean {
  return level === 1 || level === 2;
}

function startOfUtcDayFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addUtcDays(start: Date, days: number): Date {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export interface CompetencyDateContext {
  todayStart: Date;
  todayEnd: Date;
  expiringWindowEnd: Date;
}

export function getCompetencyDateContext(now: Date = new Date()): CompetencyDateContext {
  const { start, end } = utcTodayRange(now);
  const expiringWindowEnd = addUtcDays(start, 30);
  return {
    todayStart: start,
    todayEnd: end,
    expiringWindowEnd,
  };
}

/** Qualified and not expired: null expiry never expires. */
export function isActiveQualified(
  level: number | null | undefined,
  expiryDate: Date | null,
  todayStart: Date,
): boolean {
  if (!isQualifiedLevel(level)) {
    return false;
  }
  if (expiryDate === null) {
    return true;
  }
  return expiryDate >= todayStart;
}

export function isExpired(
  expiryDate: Date | null,
  todayStart: Date,
): boolean {
  if (expiryDate === null) {
    return false;
  }
  return expiryDate < todayStart;
}

/** Not yet expired, expiry within 30 days from today (inclusive window per spec). */
export function isExpiringSoon(
  level: number | null | undefined,
  expiryDate: Date | null,
  ctx: CompetencyDateContext,
): boolean {
  if (!isQualifiedLevel(level) || expiryDate === null) {
    return false;
  }
  if (expiryDate < ctx.todayStart) {
    return false;
  }
  return expiryDate <= ctx.expiringWindowEnd;
}

export function dateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ymdToUtcDate(ymd: string): Date {
  return startOfUtcDayFromYmd(ymd);
}
