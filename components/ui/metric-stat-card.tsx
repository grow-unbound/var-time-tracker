import type { ReactNode } from "react";

const borderAccents = {
  primary: "border-l-primary",
  accent: "border-l-accent",
  success: "border-l-success",
  danger: "border-l-danger",
} as const;

export type MetricStatCardAccent = keyof typeof borderAccents;

interface MetricStatCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  borderAccent: MetricStatCardAccent;
}

export function MetricStatCard({
  label,
  value,
  sub,
  borderAccent,
}: MetricStatCardProps): JSX.Element {
  return (
    <div
      className={`rounded-lg border border-border bg-surface py-4 pl-5 pr-5 shadow-card border-l-[3px] ${borderAccents[borderAccent]}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-bold leading-tight text-text-primary">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-text-secondary">{sub}</p>
      ) : null}
    </div>
  );
}
