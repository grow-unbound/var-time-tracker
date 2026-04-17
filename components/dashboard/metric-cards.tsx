"use client";

import type { DashboardMetricsDto } from "@/lib/dashboard-types";

const accents = [
  "border-l-primary",
  "border-l-accent",
  "border-l-success",
  "border-l-primary",
] as const;

interface MetricCardsProps {
  metrics: DashboardMetricsDto;
}

export function MetricCards({ metrics }: MetricCardsProps): JSX.Element {
  const items: {
    label: string;
    value: string;
    sub?: string;
  }[] = [
    {
      label: "Total hours",
      value: formatHours(metrics.totalHours),
      // sub: "logged",
    },
    {
      label: "Active projects",
      value: String(metrics.activeProjects),
      // sub: "in progress",
    },
    {
      label: "Employees",
      value: String(metrics.employeesLogged),
      // sub: "logged",
    },
    {
      label: "Entries today",
      value: String(metrics.entriesToday),
      // sub: "entries",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`rounded-lg border border-border bg-surface py-4 pl-5 pr-5 shadow-card border-l-[3px] ${accents[i]}`}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            {item.label}
          </p>
          <p className="mt-1 text-[28px] font-bold leading-tight text-text-primary">
            {item.value}
          </p>
          {item.sub ? (
            <p className="mt-1 text-xs text-text-secondary">{item.sub}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function formatHours(hours: number): string {
  if (Number.isInteger(hours)) {
    return `${hours} hours`;
  }
  return `${hours.toFixed(1)} hours`;
}
