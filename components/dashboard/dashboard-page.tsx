"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import type { BatteryDto, DepartmentDto, ProjectDto } from "@/lib/api-dtos";
import { getProjectColor } from "@/lib/constants";
import type { TimeScope } from "@/lib/dashboard-date-range";
import type { DashboardResponseDto } from "@/lib/dashboard-types";

import { DashboardFiltersPanel } from "@/components/dashboard/dashboard-filters-panel";
import {
  MetricCardsSkeleton,
  PrimaryChartSkeleton,
  SecondaryChartSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { SegmentedToggle } from "@/components/dashboard/segmented-toggle";

const PrimaryChart = dynamic(
  () =>
    import("@/components/dashboard/primary-chart").then((mod) => ({
      default: mod.PrimaryChart,
    })),
  {
    ssr: false,
    loading: () => <PrimaryChartSkeleton />,
  },
);

const SecondaryChart = dynamic(
  () =>
    import("@/components/dashboard/secondary-chart").then((mod) => ({
      default: mod.SecondaryChart,
    })),
  {
    ssr: false,
    loading: () => <SecondaryChartSkeleton />,
  },
);

function formatLastEntry(iso: string | null): string {
  if (!iso) {
    return "No entries yet";
  }
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) {
    return "Just now";
  }
  return `${mins} minute${mins === 1 ? "" : "s"} ago`;
}

export function DashboardPage(): JSX.Element {
  const primaryLegendId = useId();

  const [scope, setScope] = useState<TimeScope>("week");
  const [secondaryView, setSecondaryView] = useState<"department" | "people">(
    "department",
  );

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [batteries, setBatteries] = useState<BatteryDto[]>([]);

  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedBatteryIds, setSelectedBatteryIds] = useState<number[]>([]);

  const [dashboard, setDashboard] = useState<DashboardResponseDto | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadFilters(): Promise<void> {
      try {
        const [dRes, pRes, bRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/projects"),
          fetch("/api/batteries"),
        ]);
        if (!dRes.ok || !pRes.ok || !bRes.ok) {
          throw new Error("Failed to load filter options");
        }
        const dJson = (await dRes.json()) as { departments: DepartmentDto[] };
        const pJson = (await pRes.json()) as { projects: ProjectDto[] };
        const bJson = (await bRes.json()) as { batteries: BatteryDto[] };
        if (!cancelled) {
          setDepartments(dJson.departments);
          setProjects(pJson.projects);
          setBatteries(bJson.batteries);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load filters");
        }
      }
    }
    void loadFilters();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchDashboard = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
      if (selectedDeptIds.length > 0) {
        params.set("depts", selectedDeptIds.join(","));
      }
      if (selectedProjectIds.length > 0) {
        params.set("projects", selectedProjectIds.join(","));
      }
      if (selectedBatteryIds.length > 0) {
        params.set("batteries", selectedBatteryIds.join(","));
      }
      const res = await fetch(`/api/dashboard?${params.toString()}`, {
        cache: "no-store",
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Failed to load dashboard";
        throw new Error(msg);
      }
      setDashboard(json as DashboardResponseDto);
    } catch (e) {
      setDashboard(null);
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [scope, selectedDeptIds, selectedProjectIds, selectedBatteryIds]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const projectColorById = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of projects) {
      m.set(p.id, getProjectColor(p.colorKey));
    }
    return m;
  }, [projects]);

  const onClearFilters = useCallback(() => {
    setScope("all");
    setSelectedDeptIds([]);
    setSelectedProjectIds([]);
    setSelectedBatteryIds([]);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <header className="min-w-0 flex-1 lg:max-w-[50%]">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            Dashboard
          </p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-text-primary">
            Management overview
          </h1>
        </header>
        <DashboardFiltersPanel
          scope={scope}
          onScopeChange={setScope}
          departments={departments}
          projects={projects}
          batteries={batteries}
          selectedDeptIds={selectedDeptIds}
          selectedProjectIds={selectedProjectIds}
          selectedBatteryIds={selectedBatteryIds}
          onDeptChange={setSelectedDeptIds}
          onProjectChange={setSelectedProjectIds}
          onBatteryChange={setSelectedBatteryIds}
          showClearFilters
          onClearFilters={onClearFilters}
        />
      </div>

      {error ? (
        <div
          className="rounded-input border border-danger bg-danger-light px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {dashboard ? <MetricCards metrics={dashboard.metrics} /> : null}
      {loading && !dashboard ? <MetricCardsSkeleton /> : null}
      {loading && dashboard ? (
        <p className="text-xs text-text-secondary">Updating…</p>
      ) : null}

      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="text-base font-semibold text-text-primary">
          Hours by Project and Battery
        </h2>
        <div className="mt-4">
          {dashboard ? (
            <PrimaryChart
              rows={dashboard.primary}
              legendId={primaryLegendId}
              projectColorById={projectColorById}
            />
          ) : loading ? (
            <PrimaryChartSkeleton />
          ) : null}
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            Hours by Organization
          </h2>
          <SegmentedToggle
            ariaLabel="Secondary chart view"
            options={[
              { value: "department" as const, label: "Department" },
              { value: "people" as const, label: "People" },
            ]}
            value={secondaryView}
            onChange={setSecondaryView}
          />
        </div>
        <div className="mt-4">
          {dashboard ? (
            <SecondaryChart
              mode={secondaryView}
              byDepartment={dashboard.secondary.byDepartment}
              byEmployee={dashboard.secondary.byEmployee}
            />
          ) : loading ? (
            <SecondaryChartSkeleton />
          ) : null}
        </div>
      </section>

      <p className="text-sm text-text-secondary">
        Last entry:{" "}
        <span className="font-medium text-text-primary">
          {formatLastEntry(dashboard?.metrics.lastEntryAt ?? null)}
        </span>
      </p>
    </div>
  );
}
