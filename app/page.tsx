export default function Home(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
          VAR Electrochem
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Labor Tracker foundation is ready.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          This project is currently configured for Prisma, SQLite, and seed
          data initialization. Product UI will be added in later milestones.
        </p>
      </section>
    </main>
  );
}
