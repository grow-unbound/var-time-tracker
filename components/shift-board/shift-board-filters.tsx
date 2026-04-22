"use client";

import type { DepartmentDto, ProjectDto, ShiftDto } from "@/lib/api-dtos";
import { SearchableMultiSelect } from "@/components/dashboard/searchable-multi-select";
import { SegmentedToggle } from "@/components/dashboard/segmented-toggle";

export function ShiftBoardFilters({
  baseId,
  dateYmd,
  onDateYmd,
  shifts,
  shiftId,
  onShiftId,
  departments,
  projects,
  selectedDeptIds,
  selectedProjectIds,
  onDeptChange,
  onProjectChange,
  search,
  onSearch,
  onClearFilters,
  view,
  onView,
}: {
  baseId: string;
  dateYmd: string;
  onDateYmd: (v: string) => void;
  shifts: ShiftDto[];
  shiftId: number | null;
  onShiftId: (id: number) => void;
  departments: DepartmentDto[];
  projects: ProjectDto[];
  selectedDeptIds: number[];
  selectedProjectIds: number[];
  onDeptChange: (ids: number[]) => void;
  onProjectChange: (ids: number[]) => void;
  search: string;
  onSearch: (v: string) => void;
  onClearFilters: () => void;
  view: "matrix" | "person";
  onView: (v: "matrix" | "person") => void;
}): JSX.Element {
  const deptOptions = departments.map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const projectOptions = projects.map((p) => ({
    id: p.id,
    label: `${p.projectCode} — ${p.name}`,
  }));
  const hasFilterSelection =
    selectedDeptIds.length > 0 || selectedProjectIds.length > 0;

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedToggle
          ariaLabel="View mode"
          value={view}
          onChange={onView}
          options={[
            { value: "matrix", label: "Matrix" },
            { value: "person", label: "Person" },
          ]}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
        <label className="flex min-w-[150px] flex-col gap-1 text-xs font-medium text-text-secondary">
          Date
          <input
            type="date"
            value={dateYmd}
            onChange={(e) => onDateYmd(e.target.value)}
            className="rounded-input border border-border bg-surface px-2 py-2 text-sm text-text-primary"
          />
        </label>
        <div className="min-w-[180px]">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            Shift
          </span>
          <div
            className="inline-flex rounded-input bg-appbg p-[3px]"
            role="group"
            aria-label="Shift"
          >
            {shifts.map((s) => {
              const active = shiftId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onShiftId(s.id)}
                  className={`rounded-[6px] px-2.5 py-1.5 text-xs font-medium ${
                    active
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {s.name.replace(" Shift", "")}
                </button>
              );
            })}
          </div>
        </div>
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
        <label className="min-w-[160px] max-w-[240px] flex-1 flex flex-col gap-1 text-xs font-medium text-text-secondary">
          Employee search
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Filter by name"
            className="rounded-input border border-border bg-surface px-2 py-2 text-sm text-text-primary"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasFilterSelection}
          className="mb-0.5 rounded-input border border-border bg-appbg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
