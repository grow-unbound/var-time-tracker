import { ShiftBoardPage } from "@/components/shift-board/shift-board-page";

export default function ShiftBoardRoutePage(): JSX.Element {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
        Production planning
      </p>
      <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary">
        Shift board
      </h1>
      <div className="mt-6">
        <ShiftBoardPage />
      </div>
    </section>
  );
}
