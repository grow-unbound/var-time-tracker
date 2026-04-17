/**
 * Dashboard time scopes use UTC calendar days, matching time entry storage
 * (see lib/entry-date.ts: yyyy-mm-dd as UTC midnight through end of day).
 *
 * "This Week" = ISO 8601 week: Monday 00:00:00.000Z through Sunday 23:59:59.999Z (UTC).
 */

export type DashboardScope =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "year";

/** Time filter for dashboard and entries: includes All time (no date filter). */
export type TimeScope = DashboardScope | "all";

export interface DashboardDateRange {
  start: Date;
  end: Date;
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

function endOfUtcDay(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999Z`);
}

/** ISO 8601 week: Monday = 1 … Sunday = 7 in UTC. */
function isoWeekdayMon1Sun7(d: Date): number {
  const wd = d.getUTCDay(); // 0 Sun … 6 Sat
  return wd === 0 ? 7 : wd;
}

/** Monday of the ISO week containing `d` (UTC). */
function utcMondayOfWeek(d: Date): Date {
  const day = isoWeekdayMon1Sun7(d);
  const monday = new Date(d.getTime());
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  return startOfUtcDay(utcYmd(monday));
}

/** Sunday of the ISO week containing `d` (UTC). */
function utcSundayOfWeek(d: Date): Date {
  const monday = utcMondayOfWeek(d);
  const sunday = new Date(monday.getTime());
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return endOfUtcDay(utcYmd(sunday));
}

function firstDayOfUtcMonth(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return startOfUtcDay(
    `${y}-${String(m + 1).padStart(2, "0")}-01`,
  );
}

function lastDayOfUtcMonth(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0));
  return endOfUtcDay(utcYmd(last));
}

function firstDayOfUtcYear(d: Date): Date {
  const y = d.getUTCFullYear();
  return startOfUtcDay(`${y}-01-01`);
}

function lastDayOfUtcYear(d: Date): Date {
  const y = d.getUTCFullYear();
  return endOfUtcDay(`${y}-12-31`);
}

/** `now` defaults to current time; inject for tests. */
export function getDashboardDateRange(
  scope: DashboardScope,
  now: Date = new Date(),
): DashboardDateRange {
  const todayYmd = utcYmd(now);

  switch (scope) {
    case "today":
      return {
        start: startOfUtcDay(todayYmd),
        end: endOfUtcDay(todayYmd),
      };
    case "yesterday": {
      const y = new Date(now.getTime());
      y.setUTCDate(y.getUTCDate() - 1);
      const ymd = utcYmd(y);
      return {
        start: startOfUtcDay(ymd),
        end: endOfUtcDay(ymd),
      };
    }
    case "week":
      return {
        start: utcMondayOfWeek(now),
        end: utcSundayOfWeek(now),
      };
    case "month":
      return {
        start: firstDayOfUtcMonth(now),
        end: lastDayOfUtcMonth(now),
      };
    case "year":
      return {
        start: firstDayOfUtcYear(now),
        end: lastDayOfUtcYear(now),
      };
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }
}

/** Today's UTC calendar day range (for entriesToday metric). */
export function utcTodayRange(now: Date = new Date()): DashboardDateRange {
  const ymd = utcYmd(now);
  return {
    start: startOfUtcDay(ymd),
    end: endOfUtcDay(ymd),
  };
}

/**
 * Calendar range for a scope, or `null` when `all` (no entry-date restriction).
 */
export function getTimeScopeDateRange(
  scope: TimeScope,
  now: Date = new Date(),
): DashboardDateRange | null {
  if (scope === "all") {
    return null;
  }
  return getDashboardDateRange(scope, now);
}
