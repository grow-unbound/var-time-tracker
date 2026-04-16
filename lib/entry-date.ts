/** Calendar date as stored for time entries (matches seed: UTC midnight). */
export function entryDateFromYmd(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function entryDateRangeUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}
