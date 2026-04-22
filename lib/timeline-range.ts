export type TimelineViewMode = "week" | "month";

/** UTC midnight for calendar date of `d`. */
export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function addUtcMonths(d: Date, months: number): Date {
  const x = new Date(d);
  const day = x.getUTCDate();
  x.setUTCMonth(x.getUTCMonth() + months);
  if (x.getUTCDate() < day) {
    x.setUTCDate(0);
  }
  return startOfUtcDay(x);
}

export function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Week: T−4 weeks … T+8 weeks → 13 weekly columns (91 days span).
 * Month: T−1 month … T+4 months → 6 monthly columns from month start.
 */
export function getTimelineRange(
  mode: TimelineViewMode,
  anchor: Date,
  offsetWeeks: number,
  offsetMonths: number,
): { rangeStart: Date; rangeEndInclusive: Date; columnCount: number } {
  const t0 = startOfUtcDay(anchor);

  if (mode === "week") {
    const rangeStart = addUtcDays(t0, -28 + offsetWeeks * 7);
    const rangeEndInclusive = addUtcDays(rangeStart, 13 * 7 - 1);
    return { rangeStart, rangeEndInclusive, columnCount: 13 };
  }

  const monthAnchor = startOfUtcMonth(t0);
  const rangeStart = addUtcMonths(monthAnchor, -1 + offsetMonths);
  const rangeEndExclusive = addUtcMonths(rangeStart, 6);
  const rangeEndInclusive = addUtcDays(rangeEndExclusive, -1);
  return { rangeStart, rangeEndInclusive, columnCount: 6 };
}

export function inclusiveDaySpan(
  start: Date,
  endInclusive: Date,
): number {
  const a = startOfUtcDay(start).getTime();
  const b = startOfUtcDay(endInclusive).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export function parseYmdToUtcMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));
}

export function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Column label for header row */
export function columnLabels(
  mode: TimelineViewMode,
  rangeStart: Date,
  columnCount: number,
): string[] {
  if (mode === "week") {
    return Array.from({ length: columnCount }, (_, i) => {
      const wk = addUtcDays(rangeStart, i * 7);
      return `W${i + 1} · ${formatYmd(wk).slice(5)}`;
    });
  }
  return Array.from({ length: columnCount }, (_, i) => {
    const m = addUtcMonths(rangeStart, i);
    return m.toLocaleString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  });
}
