/** Calendar date as stored for time entries (matches seed: UTC midnight). */
export function entryDateFromYmd(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Today's calendar date in UTC (yyyy-mm-dd). */
export function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Previous calendar day in UTC (yyyy-mm-dd). */
export function utcYesterdayYmd(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function entryDateRangeUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}
