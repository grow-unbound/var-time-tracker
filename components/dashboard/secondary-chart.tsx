"use client";

import { useMemo } from "react";
import type { ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";

import "@/components/dashboard/chart-registry";
import { STAGE_COLORS } from "@/components/dashboard/chart-colors";
import type {
  DashboardDepartmentHoursDto,
  DashboardEmployeeHoursDto,
} from "@/lib/dashboard-types";

type SecondaryMode = "department" | "people";

interface SecondaryChartProps {
  mode: SecondaryMode;
  byDepartment: DashboardDepartmentHoursDto[];
  byEmployee: DashboardEmployeeHoursDto[];
}

export function SecondaryChart({
  mode,
  byDepartment,
  byEmployee,
}: SecondaryChartProps): JSX.Element {
  const { labels, rnd, production } = useMemo(() => {
    if (mode === "department") {
      return {
        labels: byDepartment.map((d) => d.departmentName),
        rnd: byDepartment.map((d) => d.rndHours),
        production: byDepartment.map((d) => d.productionHours),
      };
    }
    return {
      labels: byEmployee.map((e) => e.displayName),
      rnd: byEmployee.map((e) => e.rndHours),
      production: byEmployee.map((e) => e.productionHours),
    };
  }, [mode, byDepartment, byEmployee]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "R&D",
          data: rnd,
          backgroundColor: STAGE_COLORS.rnd,
          borderRadius: 4,
        },
        {
          label: "Production",
          data: production,
          backgroundColor: STAGE_COLORS.production,
          borderRadius: 4,
        },
      ],
    }),
    [labels, rnd, production],
  );

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { font: { size: 12 }, boxWidth: 10, boxHeight: 10 },
        },
        tooltip: {
          backgroundColor: "#FFFFFF",
          titleColor: "#1A1A2E",
          bodyColor: "#1A1A2E",
          borderColor: "#E2E8F0",
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 13 },
          bodyFont: { size: 13 },
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: { color: "rgba(0,0,0,0.06)", lineWidth: 1 },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          title: { display: true, text: "Hours" },
          ticks: { precision: 0 },
          grid: { color: "rgba(0,0,0,0.06)", lineWidth: 1 },
        },
      },
    }),
    [],
  );

  if (labels.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-secondary">
        No hours to show for this view.
      </p>
    );
  }

  return (
    <div className="relative min-h-[280px] w-full">
      <Bar data={data} options={options} />
    </div>
  );
}
