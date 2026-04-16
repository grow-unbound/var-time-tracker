export default function LogTimePage(): JSX.Element {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
        Log Time
      </p>
      <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary">
        Time entry placeholder
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
        This page is reserved for the time-entry workflow defined in the
        product spec.
      </p>
    </section>
  );
}
