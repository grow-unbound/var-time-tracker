"use client";

import { useMemo } from "react";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Bar } from "react-chartjs-2";

import { batteryStageColor, stageLabel } from "@/components/dashboard/chart-colors";
import "@/components/dashboard/chart-registry";
import type { DashboardPrimaryRowDto } from "@/lib/dashboard-types";

interface PrimaryChartProps {
  rows: DashboardPrimaryRowDto[];
  legendId: string;
}

function rowKey(
  projectId: number,
  batteryId: number,
  stage: DashboardPrimaryRowDto["stage"],
): string {
  return `${projectId}-${batteryId}-${stage}`;
}

export function PrimaryChart({ rows, legendId }: PrimaryChartProps): JSX.Element {
  const { chartData } = useMemo(() => buildChartModel(rows), [rows]);
  void legendId;

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#FFFFFF",
          titleColor: "#1A1A2E",
          bodyColor: "#1A1A2E",
          borderColor: "#E2E8F0",
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          titleFont: { size: 13 },
          bodyFont: { size: 13 },
          callbacks: {
            title: () => [],
            label: (item: TooltipItem<"bar">) => {
              const project = String(item.label ?? "");
              const parts = String(item.dataset.label ?? "").split(" · ");
              const battery = parts[0] ?? "";
              const stage = parts[1] ?? "";
              const hours = Number(item.parsed.x);
              return [
                `Project: ${project}`,
                `Battery: ${battery}`,
                `Stage: ${stage}`,
                `Hours: ${formatHours(hours)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: "Hours" },
          ticks: { precision: 0 },
          grid: { color: "rgba(0,0,0,0.06)", lineWidth: 1 },
        },
        y: {
          stacked: true,
          grid: { display: false },
        },
      },
    }),
    [],
  );

  if (chartData.labels.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-secondary">
        No time entries for the selected filters and period.
      </p>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col gap-3">
      {/* <ul
        id={legendId}
        className="flex flex-wrap gap-x-4 gap-y-2"
        aria-label="Chart legend"
      >
        {legendItems.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2 text-xs text-text-primary"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span className="text-[12px] leading-none">{item.label}</span>
          </li>
        ))}
      </ul> */}
      <div className="relative min-h-[280px] flex-1">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

function buildChartModel(rows: DashboardPrimaryRowDto[]): {
  chartData: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
      borderRadius: number;
    }[];
  };
  legendItems: { key: string; label: string; color: string }[];
} {
  const projectTotals = new Map<number, number>();
  for (const r of rows) {
    projectTotals.set(
      r.projectId,
      (projectTotals.get(r.projectId) ?? 0) + r.hours,
    );
  }

  const projectOrder = Array.from(
    new Map(rows.map((r) => [r.projectId, r.projectName])).entries(),
  )
    .sort((a, b) => {
      const diff =
        (projectTotals.get(b[0]) ?? 0) - (projectTotals.get(a[0]) ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return a[1].localeCompare(b[1]);
    })
    .map(([id]) => id);

  const labels = projectOrder.map((pid) => {
    const row = rows.find((r) => r.projectId === pid);
    return row?.projectName ?? `Project ${pid}`;
  });

  const hourLookup = new Map<string, number>();
  for (const r of rows) {
    hourLookup.set(rowKey(r.projectId, r.batteryId, r.stage), r.hours);
  }

  const batteryIds = Array.from(new Set(rows.map((r) => r.batteryId))).sort(
    (a, b) => a - b,
  );
  const batteryIndex = new Map<number, number>();
  batteryIds.forEach((id, i) => batteryIndex.set(id, i));

  const seriesKeys = Array.from(
    new Set(
      rows.map((r) => `${r.batteryId}|${r.stage}`),
    ),
  ).sort((a, b) => {
    const [ba, sa] = a.split("|");
    const [bb, sb] = b.split("|");
    const nameA = rows.find((r) => r.batteryId === Number(ba))?.batteryName ?? "";
    const nameB = rows.find((r) => r.batteryId === Number(bb))?.batteryName ?? "";
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    if (sa !== sb) {
      return sa === "RnD" ? -1 : 1;
    }
    return 0;
  });

  const datasets = seriesKeys.map((key) => {
    const [bidStr, stage] = key.split("|");
    const batteryId = Number(bidStr);
    const stageVal = stage as DashboardPrimaryRowDto["stage"];
    const sample = rows.find(
      (r) => r.batteryId === batteryId && r.stage === stageVal,
    );
    const bi = batteryIndex.get(batteryId) ?? 0;
    const color = batteryStageColor(bi, stageVal);
    const data = projectOrder.map((pid) => {
      return hourLookup.get(rowKey(pid, batteryId, stageVal)) ?? 0;
    });
    const batteryName = sample?.batteryName ?? `Battery ${batteryId}`;
    const label = `${batteryName} · ${stageLabel(stageVal)}`;
    return {
      label,
      data,
      backgroundColor: color,
      borderRadius: 4,
    };
  });

  const legendItems = seriesKeys.map((key) => {
    const [bidStr, stage] = key.split("|");
    const batteryId = Number(bidStr);
    const stageVal = stage as DashboardPrimaryRowDto["stage"];
    const bi = batteryIndex.get(batteryId) ?? 0;
    const color = batteryStageColor(bi, stageVal);
    const sample = rows.find(
      (r) => r.batteryId === batteryId && r.stage === stageVal,
    );
    const batteryName = sample?.batteryName ?? `Battery ${batteryId}`;
    return {
      key,
      label: `${batteryName} (${stageLabel(stageVal)})`,
      color,
    };
  });

  return {
    chartData: { labels, datasets },
    legendItems,
  };
}
