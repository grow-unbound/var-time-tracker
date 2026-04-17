"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { BatteryDto, DepartmentDto, ProjectDto } from "@/lib/api-dtos";
import type { TimeScope } from "@/lib/dashboard-date-range";

import { SearchableMultiSelect } from "@/components/dashboard/searchable-multi-select";

const TIME_SCOPE_OPTIONS: { value: TimeScope; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

function timeScopeSelectLabel(value: TimeScope): string {
  return (
    TIME_SCOPE_OPTIONS.find((o) => o.value === value)?.label ?? "All time"
  );
}

/**
 * Single-select control styled to match {@link SearchableMultiSelect} trigger
 * (label + bordered button + chevron).
 */
function TimeScopeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: TimeScope;
  onChange: (next: TimeScope) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isFiltered = value !== "all";

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const summary = useMemo(() => timeScopeSelectLabel(value), [value]);

  return (
    <div ref={rootRef} className="relative min-w-[140px] max-w-[200px]">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
        Time scope
      </span>
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded-input border px-2 py-2 text-left text-xs font-medium transition-colors ${
          isFiltered
            ? "border-primary bg-[rgba(27,58,92,0.06)] text-primary"
            : "border-border bg-surface text-text-primary hover:border-[#9aaec1]"
        }`}
      >
        <span className="truncate">{summary}</span>
        <svg
          aria-hidden
          className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 w-full min-w-[200px] max-w-[min(100vw-2rem,320px)] rounded-input border border-border bg-surface p-1 shadow-card"
          role="listbox"
          aria-labelledby={id}
        >
          <ul className="max-h-60 overflow-y-auto overscroll-contain py-1">
            {TIME_SCOPE_OPTIONS.map((o) => (
              <li key={o.value} role="option" aria-selected={value === o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center rounded-input px-3 py-2 text-left text-sm ${
                    value === o.value
                      ? "bg-appbg font-medium text-primary"
                      : "text-text-primary hover:bg-appbg"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export interface AppFiltersPanelProps {
  timeScope: TimeScope;
  onTimeScopeChange: (scope: TimeScope) => void;
  departments: DepartmentDto[];
  projects: ProjectDto[];
  batteries: BatteryDto[];
  selectedDeptIds: number[];
  selectedProjectIds: number[];
  selectedBatteryIds: number[];
  onDeptChange: (ids: number[]) => void;
  onProjectChange: (ids: number[]) => void;
  onBatteryChange: (ids: number[]) => void;
  /** When true, shows Clear filters (entries page). */
  showClearFilters?: boolean;
  onClearFilters?: () => void;
}

export function AppFiltersPanel({
  timeScope,
  onTimeScopeChange,
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
}: AppFiltersPanelProps): JSX.Element {
  const baseId = useId();

  const deptOptions = departments.map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const projectOptions = projects.map((p) => ({
    id: p.id,
    label: p.name,
  }));
  const batteryOptions = batteries.map((b) => ({
    id: b.id,
    label: `${b.modelName} (project ${b.projectId})`,
  }));

  const hasFilterSelection =
    selectedDeptIds.length > 0 ||
    selectedProjectIds.length > 0 ||
    selectedBatteryIds.length > 0 ||
    timeScope !== "all";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2 lg:justify-end">
      <TimeScopeSelect
        id={`${baseId}-time-scope`}
        value={timeScope}
        onChange={onTimeScopeChange}
      />
      <div className="min-w-[140px] max-w-[200px]">
        <SearchableMultiSelect
          id={`${baseId}-dept`}
          label="Departments"
          options={deptOptions}
          selectedIds={selectedDeptIds}
          onChange={onDeptChange}
        />
      </div>
      <div className="min-w-[140px] max-w-[200px]">
        <SearchableMultiSelect
          id={`${baseId}-project`}
          label="Projects"
          options={projectOptions}
          selectedIds={selectedProjectIds}
          onChange={onProjectChange}
        />
      </div>
      <div className="min-w-[140px] max-w-[200px]">
        <SearchableMultiSelect
          id={`${baseId}-battery`}
          label="Battery"
          options={batteryOptions}
          selectedIds={selectedBatteryIds}
          onChange={onBatteryChange}
        />
      </div>
      {showClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasFilterSelection}
          className="mb-0.5 rounded-input border border-border bg-appbg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
