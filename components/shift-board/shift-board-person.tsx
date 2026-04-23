"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { getProjectColor } from "@/lib/constants";
import { MAX_SHIFT_HOURS } from "@/lib/shift-board-constants";
import {
  shiftBoardEmptySearchRowClass,
  shiftBoardGroupRowClass,
  shiftBoardMatrixAddStripClass,
  shiftBoardMatrixChipListClass,
  shiftBoardMatrixProjectCellGroupClass,
  shiftBoardPersonHrsStickyClass,
  shiftBoardPersonRowMinHeightPx,
  shiftBoardProjectHeaderCellClass,
  shiftBoardTableHeaderClass,
} from "@/lib/shift-board-table-ui";
import type {
  ShiftBoardPersonAssignmentDto,
  ShiftBoardPersonResponseDto,
} from "@/lib/shift-board-dto";

const COL_MIN_PX = 200;
const STICKY_EMP_W = 220;
const STICKY_HRS_W = 100;
const PROJECT_COLUMN_TINT_ALPHA = 0.14;

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) {
    return `rgba(0,0,0,${alpha})`;
  }
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function groupByDept(
  employees: ShiftBoardPersonResponseDto["employees"],
): {
  departmentId: number;
  departmentName: string;
  rows: typeof employees;
}[] {
  const out: {
    departmentId: number;
    departmentName: string;
    rows: typeof employees;
  }[] = [];
  for (const e of employees) {
    const last = out[out.length - 1];
    if (last && last.departmentId === e.departmentId) {
      last.rows.push(e);
    } else {
      out.push({
        departmentId: e.departmentId,
        departmentName: e.departmentName,
        rows: [e],
      });
    }
  }
  return out;
}

function nameMatches(
  q: string,
  e: ShiftBoardPersonResponseDto["employees"][0],
): boolean {
  if (!q.trim()) {
    return true;
  }
  const t = q.trim().toLowerCase();
  return (
    e.departmentName.toLowerCase().includes(t) ||
    e.firstName.toLowerCase().includes(t) ||
    e.lastName.toLowerCase().includes(t) ||
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(t)
  );
}

function sortPersonEmployees(
  a: ShiftBoardPersonResponseDto["employees"][0],
  b: ShiftBoardPersonResponseDto["employees"][0],
): number {
  const d = a.departmentName.localeCompare(b.departmentName, undefined, {
    sensitivity: "base",
  });
  if (d !== 0) {
    return d;
  }
  const f = a.firstName.localeCompare(b.firstName, undefined, {
    sensitivity: "base",
  });
  if (f !== 0) {
    return f;
  }
  return a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
}

function createCellPayload(
  e: ShiftBoardPersonResponseDto["employees"][0],
  col: { projectId: number; projectName: string },
): {
  empId: string;
  firstName: string;
  lastName: string;
  departmentId: number;
  projectId: number;
  projectName: string;
} {
  return {
    empId: e.empId,
    firstName: e.firstName,
    lastName: e.lastName,
    departmentId: e.departmentId,
    projectId: col.projectId,
    projectName: col.projectName,
  };
}

type Col = ShiftBoardPersonResponseDto["cols"][0];

type PersonProjectCellProps = {
  e: ShiftBoardPersonResponseDto["employees"][0];
  col: Col;
  list: ShiftBoardPersonAssignmentDto[];
  canAddMore: boolean;
  rowMinPx: number;
  onCreateCell: (p: ReturnType<typeof createCellPayload>) => void;
  onEditAssignment: (
    row: ShiftBoardPersonResponseDto["employees"][0],
    a: ShiftBoardPersonAssignmentDto,
  ) => void;
};

function PersonProjectCell({
  e,
  col,
  list,
  canAddMore,
  rowMinPx,
  onCreateCell,
  onEditAssignment,
}: PersonProjectCellProps): JSX.Element | null {
  const hasCell = list.length > 0;
  const hex = getProjectColor(col.colorKey);
  const cellBg = hasCell
    ? hexWithAlpha(hex, PROJECT_COLUMN_TINT_ALPHA * 0.45)
    : undefined;
  const borderL = `${hex}35`;
  const addStripClass = [
    shiftBoardMatrixAddStripClass,
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
  ].join(" ");

  if (hasCell) {
    if (canAddMore) {
      return (
        <div
          className={`${shiftBoardMatrixProjectCellGroupClass} min-h-0 border-border/30`}
          style={{ minHeight: rowMinPx, backgroundColor: cellBg, borderLeftColor: borderL }}
        >
          <div className={shiftBoardMatrixChipListClass}>
            <div className="flex w-full min-w-0 flex-col gap-1">
              {list.map((a) => (
                <button
                  key={a.assignmentId}
                  type="button"
                  onClick={() => onEditAssignment(e, a)}
                  className="inline-flex w-full min-w-0 max-w-full shrink-0 items-center justify-start gap-1 rounded-input border border-border px-1.5 py-1 text-left text-[11px] font-medium leading-snug"
                  style={{
                    backgroundColor: `${getProjectColor(a.colorKey)}18`,
                    color: getProjectColor(a.colorKey),
                    borderColor: `${getProjectColor(a.colorKey)}55`,
                  }}
                >
                  <span className="min-w-0 break-words">
                    {a.activityName} · {a.durationHours}h
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              tabIndex={0}
              aria-label={`Add assignment for ${e.firstName} ${e.lastName} on ${col.projectName}`}
              onClick={() => onCreateCell(createCellPayload(e, col))}
              className={addStripClass}
            >
              + Add assignment
            </button>
          </div>
        </div>
      );
    }
    return (
      <div
        className={`${shiftBoardMatrixProjectCellGroupClass} min-h-0 border-border/30`}
        style={{ minHeight: rowMinPx, backgroundColor: cellBg, borderLeftColor: borderL }}
      >
        <div className={`${shiftBoardMatrixChipListClass} flex min-h-0 flex-1 flex-col`}>
          {list.map((a) => (
            <button
              key={a.assignmentId}
              type="button"
              onClick={() => onEditAssignment(e, a)}
              className="inline-flex w-full min-w-0 max-w-full shrink-0 items-center justify-start gap-1 rounded-input border border-border px-1.5 py-1 text-left text-[11px] font-medium leading-snug"
              style={{
                backgroundColor: `${getProjectColor(a.colorKey)}18`,
                color: getProjectColor(a.colorKey),
                borderColor: `${getProjectColor(a.colorKey)}55`,
              }}
            >
              <span className="min-w-0 break-words">
                {a.activityName} · {a.durationHours}h
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (canAddMore) {
    return (
      <div
        className={`${shiftBoardMatrixProjectCellGroupClass} min-h-0 border-border/30 bg-border/20`}
        style={{ minHeight: rowMinPx, backgroundColor: cellBg, borderLeftColor: borderL }}
      >
        <button
          type="button"
          className="relative box-border flex w-full min-w-0 flex-1 flex-col items-stretch p-0 text-left outline-none"
          style={{ minHeight: rowMinPx }}
          onClick={() => onCreateCell(createCellPayload(e, col))}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onCreateCell(createCellPayload(e, col));
            }
          }}
        >
          <span
            className="pointer-events-none flex min-h-0 flex-1 items-center justify-center px-2 text-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100"
            aria-hidden
          >
            Add assignment
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${shiftBoardMatrixProjectCellGroupClass} min-h-0 border-border/30 bg-border/20`}
      style={{ minHeight: rowMinPx, borderLeftColor: borderL }}
    >
      <div
        className="min-h-0 flex-1"
        style={{ minHeight: rowMinPx }}
        aria-hidden
      />
    </div>
  );
}

function personGridStyle(nProjects: number): CSSProperties {
  const w = STICKY_EMP_W + STICKY_HRS_W + nProjects * COL_MIN_PX;
  return {
    minWidth: `${w}px`,
    gridTemplateColumns: `${STICKY_EMP_W}px ${STICKY_HRS_W}px repeat(${nProjects}, minmax(${COL_MIN_PX}px, 1fr))`,
  };
}

export function ShiftBoardPerson({
  data,
  search,
  onCreateCell,
  onEditAssignment,
}: {
  data: ShiftBoardPersonResponseDto;
  search: string;
  onCreateCell: (p: {
    empId: string;
    firstName: string;
    lastName: string;
    departmentId: number;
    projectId: number;
    projectName: string;
  }) => void;
  onEditAssignment: (
    row: ShiftBoardPersonResponseDto["employees"][0],
    a: ShiftBoardPersonAssignmentDto,
  ) => void;
}): JSX.Element {
  const [openDepts, setOpenDepts] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const e of data.employees) {
      s.add(e.departmentId);
    }
    return s;
  });

  const toggleDept = useCallback((id: number) => {
    setOpenDepts((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }, []);

  const filtered = useMemo(
    () =>
      data.employees
        .filter((e) => nameMatches(search, e))
        .sort(sortPersonEmployees),
    [data.employees, search],
  );

  const groups = useMemo(() => groupByDept(filtered), [filtered]);

  if (data.employees.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No employees to show.</p>
    );
  }

  if (data.cols.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No projects match the current filters.
      </p>
    );
  }

  const n = data.cols.length;
  const hasRowMatches = groups.length > 0;
  const tableGridStyle = personGridStyle(n);

  return (
    <div className="overflow-x-auto rounded-input border border-border">
      <div className="grid w-full" style={tableGridStyle}>
        <div
          className={`${shiftBoardTableHeaderClass} sticky left-0 z-[35] box-border min-w-0 border-r border-border bg-surface`}
        >
          Employee
        </div>
        <div
          className={`${shiftBoardPersonHrsStickyClass} box-border flex h-11 min-h-11 items-center justify-center border-b border-border text-center text-[11px] font-medium uppercase leading-none tracking-wide text-text-secondary`}
          style={{ left: STICKY_EMP_W }}
        >
          Assigned hours
        </div>
        {data.cols.map((c) => {
          const hex = getProjectColor(c.colorKey);
          return (
            <div
              key={c.projectId}
              className={shiftBoardProjectHeaderCellClass}
              style={{
                backgroundColor: hexWithAlpha(hex, PROJECT_COLUMN_TINT_ALPHA),
                borderLeftColor: `${hex}55`,
              }}
            >
              <span className="min-w-0 max-w-full truncate text-text-primary">
                {c.projectName}
              </span>
            </div>
          );
        })}

        {hasRowMatches
          ? groups.map((g) => {
              const isOpen = openDepts.has(g.departmentId);
              return (
                <Fragment key={g.departmentId}>
                  <div
                    className={`${shiftBoardGroupRowClass} sticky left-0 z-[32] box-border min-w-0 border-r border-border bg-surface`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDept(g.departmentId)}
                      className="inline-flex w-full min-w-0 items-center gap-2 truncate text-left text-sm font-medium leading-5 text-text-primary"
                    >
                      <span className="shrink-0 text-text-secondary" aria-hidden>
                        {isOpen ? "▼" : "▶"}
                      </span>
                      {g.departmentName}
                    </button>
                  </div>
                  <div
                    className={`${shiftBoardPersonHrsStickyClass} border-b border-border bg-surface/80`}
                    style={{ left: STICKY_EMP_W }}
                    aria-hidden
                  />
                  {data.cols.map((col) => {
                    const hex = getProjectColor(col.colorKey);
                    return (
                      <div
                        key={`d-${g.departmentId}-${col.projectId}`}
                        className="box-border h-11 min-h-11 border-b border-l border-border/40"
                        style={{
                          backgroundColor: hexWithAlpha(
                            hex,
                            PROJECT_COLUMN_TINT_ALPHA * 0.65,
                          ),
                          borderLeftColor: `${hex}40`,
                        }}
                        aria-hidden
                      />
                    );
                  })}

                  {isOpen
                    ? g.rows.map((e) => {
                        const hours = Number(e.totalHours);
                        // Unassigned (0h) employees must be able to add; `isUnassigned` is a display label only.
                        const canAddMore =
                          Number.isFinite(hours) && hours < MAX_SHIFT_HOURS;
                        const perColCounts = data.cols.map(
                          (col) =>
                            e.assignments.filter(
                              (a) => a.projectId === col.projectId,
                            ).length,
                        );
                        const rowMinPx = shiftBoardPersonRowMinHeightPx(
                          perColCounts,
                          canAddMore,
                        );
                        return (
                          <Fragment key={e.empId}>
                            <div
                              className="sticky left-0 z-[32] box-border flex min-w-0 items-center border-b border-r border-border bg-surface pl-1 pr-2 text-sm leading-snug text-text-primary"
                              style={{ minHeight: rowMinPx }}
                            >
                              <span className="w-4 shrink-0" aria-hidden />
                              <span className="line-clamp-4 min-w-0 flex-1 [overflow-wrap:anywhere]">
                                {e.firstName} {e.lastName}
                              </span>
                            </div>
                            <div
                              className={`${shiftBoardPersonHrsStickyClass} z-[32] box-border flex items-center justify-center border-b border-border px-1.5 text-center font-mono text-sm leading-snug text-text-primary`}
                              style={{
                                left: STICKY_EMP_W,
                                minHeight: rowMinPx,
                              }}
                            >
                              {e.isUnassigned ? "—" : `${e.totalHours}h`}
                            </div>
                            {data.cols.map((col) => {
                              const list = e.assignments.filter(
                                (a) => a.projectId === col.projectId,
                              );
                              return (
                                <PersonProjectCell
                                  key={`${e.empId}-${col.projectId}`}
                                  e={e}
                                  col={col}
                                  list={list}
                                  canAddMore={canAddMore}
                                  rowMinPx={rowMinPx}
                                  onCreateCell={onCreateCell}
                                  onEditAssignment={onEditAssignment}
                                />
                              );
                            })}
                          </Fragment>
                        );
                      })
                    : null}
                </Fragment>
              );
            })
          : (
              <Fragment>
                <div
                  className={`${shiftBoardEmptySearchRowClass} sticky left-0 z-[32] min-w-0 border-r border-border bg-surface`}
                >
                  <span className="w-4 shrink-0" aria-hidden />
                  <span>No employees match the current search.</span>
                </div>
                <div
                  className={`${shiftBoardPersonHrsStickyClass} border-b border-border`}
                  style={{ left: STICKY_EMP_W }}
                  aria-hidden
                />
                {data.cols.map((col) => {
                  const hex = getProjectColor(col.colorKey);
                  return (
                    <div
                      key={`empty-p-${col.projectId}`}
                      className="box-border h-11 min-h-11 border-b border-l border-border/40"
                      style={{
                        backgroundColor: hexWithAlpha(
                          hex,
                          PROJECT_COLUMN_TINT_ALPHA * 0.45,
                        ),
                        borderLeftColor: `${hex}35`,
                      }}
                      aria-hidden
                    />
                  );
                })}
              </Fragment>
            )}
      </div>
    </div>
  );
}
