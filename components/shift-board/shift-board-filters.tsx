"use client";

import { useCallback, useId, useRef } from "react";

import type { DepartmentDto, ProjectDto, ShiftDto } from "@/lib/api-dtos";
import { SearchableMultiSelect } from "@/components/dashboard/searchable-multi-select";
import { SegmentedToggle } from "@/components/dashboard/segmented-toggle";
import { localYmd } from "@/lib/shift-board-date";

const SEARCH_PLACEHOLDER: Record<"matrix" | "person", string> = {
  matrix: "Search Department or Activity",
  person: "Search Department or Employee",
};

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return localYmd(dt);
}

function formatDateNavLabel(ymd: string): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateFieldId = useId();

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

  const openDatePicker = useCallback(() => {
    const el = dateInputRef.current;
    if (!el) {
      return;
    }
    if (typeof el.showPicker === "function") {
      void el.showPicker();
    } else {
      el.click();
    }
  }, []);

  return (
    <div className="grid w-full grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_1fr]">
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 md:justify-start">
        <div className="shrink-0">
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
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER[view]}
          className="min-w-0 w-full max-w-md flex-1 rounded-input border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/80"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="relative">
          <input
            id={dateFieldId}
            ref={dateInputRef}
            type="date"
            value={dateYmd}
            onChange={(e) => onDateYmd(e.target.value)}
            aria-label="Choose shift date"
            className="sr-only"
          />
          <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-0.5 shadow-sm">
            <button
              type="button"
              aria-label="Previous day"
              className="shrink-0 rounded border border-transparent px-1.5 py-0.5 text-sm hover:bg-appbg active:scale-95"
              onClick={() => onDateYmd(addDaysToYmd(dateYmd, -1))}
            >
              ←
            </button>
            <button
              type="button"
              className="max-w-[11rem] min-w-0 truncate px-1 py-0.5 text-center text-[11px] leading-tight text-text-secondary underline decoration-border decoration-dotted underline-offset-2 hover:text-text-primary"
              onClick={openDatePicker}
              aria-controls={dateFieldId}
              title={formatDateNavLabel(dateYmd)}
              aria-label={`Shift date: ${formatDateNavLabel(dateYmd)}. Click to open calendar.`}
            >
              {formatDateNavLabel(dateYmd)}
            </button>
            <button
              type="button"
              aria-label="Next day"
              className="shrink-0 rounded border border-transparent px-1.5 py-0.5 text-sm hover:bg-appbg active:scale-95"
              onClick={() => onDateYmd(addDaysToYmd(dateYmd, 1))}
            >
              →
            </button>
          </div>
        </div>

        <div className="min-w-[10rem]">
          <select
            id={`${baseId}-shift`}
            value={shiftId ?? ""}
            onChange={(e) => onShiftId(Number(e.target.value))}
            aria-label="Shift"
            className="w-full min-w-0 rounded-input border border-border bg-surface px-2 py-2 text-sm text-text-primary"
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.replace(" Shift", "")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 md:justify-end">
        <div className="min-w-[130px] max-w-[200px]">
          <SearchableMultiSelect
            id={`${baseId}-dept`}
            label="Departments"
            labelLayout="inline"
            options={deptOptions}
            selectedIds={selectedDeptIds}
            onChange={onDeptChange}
          />
        </div>
        <div className="min-w-[130px] max-w-[200px]">
          <SearchableMultiSelect
            id={`${baseId}-project`}
            label="Projects"
            labelLayout="inline"
            options={projectOptions}
            selectedIds={selectedProjectIds}
            onChange={onProjectChange}
          />
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasFilterSelection}
          className="shrink-0 rounded-input border border-border bg-appbg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
