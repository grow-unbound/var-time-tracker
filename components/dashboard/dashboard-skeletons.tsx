import { Skeleton } from "@/components/ui/skeleton";

/** Matches {@link MetricCards} grid and card chrome. */
export function MetricCardsSkeleton(): JSX.Element {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading metrics</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-surface py-4 pl-5 pr-5 shadow-card"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Horizontal stacked bar chart (indexAxis: y), ~{@link PrimaryChart} layout. */
export function PrimaryChartSkeleton(): JSX.Element {
  const widths = ["72%", "55%", "88%", "40%", "65%", "92%", "48%", "76%"];
  return (
    <div
      className="flex min-h-[320px] flex-col justify-center gap-2.5 py-2"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading chart</span>
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-20 shrink-0 sm:w-28" />
          <div className="min-h-[28px] min-w-0 flex-1 rounded-input bg-appbg p-1">
            <Skeleton className="h-6 rounded-sm" style={{ width: w }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical bars + legend strip, ~{@link SecondaryChart} layout. */
export function SecondaryChartSkeleton(): JSX.Element {
  const barHeightsPct = [42, 68, 36, 82, 52, 74, 40, 90, 48, 65, 55, 72];
  return (
    <div
      className="min-h-[280px] space-y-4"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading chart</span>
      <div className="flex justify-end gap-5 pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2.5 w-2.5 rounded-sm" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-2.5 w-2.5 rounded-sm" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex h-[200px] items-end gap-1.5 px-1 sm:gap-2">
        {barHeightsPct.map((h, i) => (
          <Skeleton
            key={i}
            className="min-w-0 flex-1 rounded-t-sm rounded-b-none"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
