"use client";

import type { BatteryDto, DepartmentDto, ProjectDto } from "@/lib/api-dtos";
import type { TimeScope } from "@/lib/dashboard-date-range";

import { AppFiltersPanel } from "@/components/filters/app-filters-panel";

/** @deprecated Prefer {@link AppFiltersPanel} — kept for stable dashboard imports. */
export function DashboardFiltersPanel({
  scope,
  onScopeChange,
  departments,
  projects,
  batteries,
  selectedDeptIds,
  selectedProjectIds,
  selectedBatteryIds,
  onDeptChange,
  onProjectChange,
  onBatteryChange,
  showClearFilters = false,
  onClearFilters,
}: {
  scope: TimeScope;
  onScopeChange: (scope: TimeScope) => void;
  departments: DepartmentDto[];
  projects: ProjectDto[];
  batteries: BatteryDto[];
  selectedDeptIds: number[];
  selectedProjectIds: number[];
  selectedBatteryIds: number[];
  onDeptChange: (ids: number[]) => void;
  onProjectChange: (ids: number[]) => void;
  onBatteryChange: (ids: number[]) => void;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
}): JSX.Element {
  return (
    <div className="w-full lg:ml-auto lg:max-w-[50%]">
      <div className="rounded-card border border-border bg-surface p-3 shadow-card">
        <AppFiltersPanel
          timeScope={scope}
          onTimeScopeChange={onScopeChange}
          departments={departments}
          projects={projects}
          batteries={batteries}
          selectedDeptIds={selectedDeptIds}
          selectedProjectIds={selectedProjectIds}
          selectedBatteryIds={selectedBatteryIds}
          onDeptChange={onDeptChange}
          onProjectChange={onProjectChange}
          onBatteryChange={onBatteryChange}
          showClearFilters={showClearFilters}
          onClearFilters={onClearFilters}
        />
      </div>
    </div>
  );
}
