import { Suspense } from "react";

import { EntriesTable } from "@/components/entries/entries-table";
import { EntriesTableFullSkeleton } from "@/components/entries/entries-table-skeleton";

function EntriesTableFallback(): JSX.Element {
  return <EntriesTableFullSkeleton />;
}

export default function EntriesPage(): JSX.Element {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
        All Entries
      </p>
      <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary">
        Time entry log
      </h1>
      <div className="mt-6">
        <Suspense fallback={<EntriesTableFallback />}>
          <EntriesTable />
        </Suspense>
      </div>
    </section>
  );
}
