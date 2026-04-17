import { Skeleton } from "@/components/ui/skeleton";

const CELL_BAR_CLASSES = [
  "w-24",
  "w-36",
  "w-28",
  "w-32",
  "w-28",
  "w-24",
  "w-16",
  "w-14",
  "w-16",
] as const;

/** Table body rows only; thead stays real in {@link EntriesTable}. */
export function EntriesTableBodySkeletonRows({
  rows = 10,
}: {
  rows?: number;
}): JSX.Element {
  return (
    <>
      {Array.from({ length: rows }, (_, ri) => (
        <tr key={ri} className="border-b border-border last:border-b-0">
          {CELL_BAR_CLASSES.map((w, ci) => (
            <td key={ci} className="px-3 py-2.5">
              <Skeleton className={`h-4 max-w-full ${w}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Search + filters + table shell for Suspense / initial layout match. */
export function EntriesTableFullSkeleton(): JSX.Element {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Loading entries</span>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:gap-4">
        <div className="flex min-w-[200px] max-w-md flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-10 w-full rounded-input" />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2 lg:justify-end">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="min-w-[140px] max-w-[200px]">
              <Skeleton className="mb-1 h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-input" />
            </div>
          ))}
          <Skeleton className="mb-0.5 h-10 w-[7.5rem] rounded-input" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-input border border-border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-appbg">
              {CELL_BAR_CLASSES.map((_, i) => (
                <th key={i} scope="col" className="px-3 py-2 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <EntriesTableBodySkeletonRows rows={12} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
