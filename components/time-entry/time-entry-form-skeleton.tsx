import { Skeleton } from "@/components/ui/skeleton";

function FieldSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-10 w-full rounded-input" />
    </div>
  );
}

/** Mirrors header card + first entry row + actions strip. */
export function TimeEntryFormSkeleton(): JSX.Element {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading time entry form</span>
      <header className="rounded-card border border-border bg-surface p-6 shadow-card">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-48 max-w-full" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2 w-full rounded bg-border" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </header>

      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <div className="flex flex-col gap-1.5 lg:col-span-2 xl:col-span-1">
            <Skeleton className="h-3.5 w-16" />
            <div className="flex flex-wrap items-end gap-6 pt-1">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-10" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-input" />
                  <Skeleton className="h-9 w-14 rounded-input" />
                  <Skeleton className="h-9 w-9 shrink-0 rounded-input" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-14" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-input" />
                  <Skeleton className="h-9 w-14 rounded-input" />
                  <Skeleton className="h-9 w-9 shrink-0 rounded-input" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-9 w-28 rounded-input" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Skeleton className="h-10 w-56 max-w-full rounded-input" />
        <Skeleton className="h-10 w-32 rounded-input" />
      </div>
    </div>
  );
}
