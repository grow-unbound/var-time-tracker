import {
  inclusiveDaySpan,
  parseYmdToUtcMidnight,
  startOfUtcDay,
} from "@/lib/timeline-range";

export interface BarLayout {
  leftPct: number;
  widthPct: number;
}

/**
 * Inclusive planned dates vs inclusive range; bar clipped to [0,100].
 */
export function barLayoutForRange(
  plannedStartYmd: string | null,
  plannedEndYmd: string | null,
  rangeStart: Date,
  rangeEndInclusive: Date,
): BarLayout | null {
  if (!plannedStartYmd || !plannedEndYmd) {
    return null;
  }

  const p0 = parseYmdToUtcMidnight(plannedStartYmd);
  const p1 = parseYmdToUtcMidnight(plannedEndYmd);
  const r0 = startOfUtcDay(rangeStart);
  const r1 = startOfUtcDay(rangeEndInclusive);

  const totalDays = inclusiveDaySpan(r0, r1);
  const totalMs = totalDays * 86_400_000;

  const rangeStartMs = r0.getTime();
  const rangeEndMs = r1.getTime() + 86_400_000;

  const barStartMs = Math.max(p0.getTime(), rangeStartMs);
  const barEndMs = Math.min(p1.getTime() + 86_400_000, rangeEndMs);

  if (barEndMs <= barStartMs) {
    return null;
  }

  const leftPx = ((barStartMs - rangeStartMs) / totalMs) * 100;
  const widthPx = ((barEndMs - barStartMs) / totalMs) * 100;

  return {
    leftPct: Math.max(0, Math.min(100, leftPx)),
    widthPct: Math.max(0, Math.min(100 - leftPx, widthPx)),
  };
}

export function percentForDateInRange(
  ymd: string,
  rangeStart: Date,
  rangeEndInclusive: Date,
): number | null {
  const t = parseYmdToUtcMidnight(ymd);
  const r0 = startOfUtcDay(rangeStart);
  const r1 = startOfUtcDay(rangeEndInclusive);
  const totalDays = inclusiveDaySpan(r0, r1);
  const totalMs = totalDays * 86_400_000;
  const x = ((t.getTime() - r0.getTime()) / totalMs) * 100;
  if (x < 0 || x > 100) {
    return null;
  }
  return x;
}

export function plannedHoursFromYmd(
  startYmd: string | null,
  endYmd: string | null,
): number {
  if (!startYmd || !endYmd) {
    return 8;
  }
  const a = parseYmdToUtcMidnight(startYmd);
  const b = parseYmdToUtcMidnight(endYmd);
  const days = inclusiveDaySpan(a, b);
  return Math.max(1, days) * 8;
}
