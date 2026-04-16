export default function Home(): JSX.Element {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
        Dashboard
      </p>
      <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary">
        App shell ready
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
        Placeholder content for the dashboard. The navigation, topbar, sidebar,
        theme tokens, and global shell styles are now in place.
      </p>
    </section>
  );
}
