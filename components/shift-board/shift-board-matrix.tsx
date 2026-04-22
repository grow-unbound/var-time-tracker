"use client";

import { Fragment, useCallback, useMemo, useState } from "react";

import { getProjectColor } from "@/lib/constants";
import { getDepartmentChipStyle } from "@/lib/shift-board-styles";
import {
  shiftBoardEmptySearchRowClass,
  shiftBoardGroupRowClass,
  shiftBoardMatrixAddStripClass,
  shiftBoardMatrixChipListClass,
  shiftBoardMatrixProjectCellGroupClass,
  shiftBoardMatrixRowMinHeightPx,
  shiftBoardMatrixStickyFirstColClass,
  shiftBoardProjectHeaderCellClass,
  shiftBoardTableHeaderClass,
} from "@/lib/shift-board-table-ui";
import type {
  ShiftBoardAssignmentDto,
  ShiftBoardResponseDto,
} from "@/lib/shift-board-dto";

const LEFT_COL_W = 260;
const COL_MIN_PX = 200;
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

function initials(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function groupRows(
  rows: ShiftBoardResponseDto["rows"],
): { departmentId: number; departmentName: string; rows: typeof rows }[] {
  const out: {
    departmentId: number;
    departmentName: string;
    rows: typeof rows;
  }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.departmentId === r.departmentId) {
      last.rows.push(r);
    } else {
      out.push({
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        rows: [r],
      });
    }
  }
  return out;
}

function rowMatchesFilter(
  q: string,
  r: ShiftBoardResponseDto["rows"][0],
): boolean {
  if (!q.trim()) {
    return true;
  }
  const t = q.trim().toLowerCase();
  return (
    r.departmentName.toLowerCase().includes(t) ||
    r.activityName.toLowerCase().includes(t)
  );
}

type Col = ShiftBoardResponseDto["cols"][0];

type MatrixProjectCellProps = {
  subId: number | null;
  list: ShiftBoardAssignmentDto[];
  rowMinPx: number;
  hex: string;
  projectName: string;
  activityName: string;
  row: ShiftBoardResponseDto["rows"][0];
  col: Col;
  onCellAssign: (ctx: {
    activityId: number;
    activityName: string;
    projectId: number;
    projectName: string;
    subProjectId: number;
  }) => void;
  onAssignmentClick: (a: ShiftBoardAssignmentDto) => void;
};

function MatrixProjectCell({
  subId,
  list,
  rowMinPx,
  hex,
  projectName,
  activityName,
  row,
  col,
  onCellAssign,
  onAssignmentClick,
}: MatrixProjectCellProps): JSX.Element | null {
  const hasAssignments = list.length > 0;
  const canOpenCreate = subId != null;
  const showEmptyAdd = canOpenCreate && !hasAssignments;

  const cellBg = subId == null
    ? undefined
    : hexWithAlpha(hex, PROJECT_COLUMN_TINT_ALPHA * 0.45);
  const borderL = `${hex}35`;

  const addStripClass = [
    shiftBoardMatrixAddStripClass,
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
  ].join(" ");

  if (subId == null) {
    return (
      <div
        className={`${shiftBoardMatrixProjectCellGroupClass} min-h-0 bg-border/20`}
        style={{ minHeight: rowMinPx, backgroundColor: cellBg, borderLeftColor: borderL }}
        aria-label={`${activityName} / ${col.projectName} — no sub-project`}
      >
        <div
          className="flex flex-1 items-center justify-center p-1.5"
          style={{ minHeight: rowMinPx }}
        >
          <span className="text-[10px] leading-snug text-text-secondary">—</span>
        </div>
      </div>
    );
  }

  if (hasAssignments) {
    return (
      <div
        className={`${shiftBoardMatrixProjectCellGroupClass} min-h-0 border-border/30 bg-transparent`}
        style={{ minHeight: rowMinPx, backgroundColor: cellBg, borderLeftColor: borderL }}
        aria-label={`${activityName} on ${col.projectName}`}
      >
        <div className={shiftBoardMatrixChipListClass}>
          <div className="flex min-h-0 w-full min-w-0 flex-col gap-1">
            {list.map((a) => (
              <button
                key={a.assignmentId}
                type="button"
                onClick={() => onAssignmentClick(a)}
                className="inline-flex w-full min-w-0 max-w-full shrink-0 items-center gap-1.5 rounded-input border border-border px-1.5 py-1 text-left text-[11px] font-medium leading-snug"
                style={getDepartmentChipStyle(a.departmentId)}
                title={
                  Number(a.assignmentCountForEmployee) > 4
                    ? "Multiple assignments this shift (review load)"
                    : `${a.firstName} ${a.lastName} · ${a.durationHours}h`
                }
              >
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/50 text-[8px] font-bold leading-none"
                  aria-hidden
                >
                  {initials(a.firstName, a.lastName)}
                </span>
                <span className="min-w-0 break-words">
                  {a.firstName} · {a.durationHours}h
                </span>
              </button>
            ))}
          </div>
        </div>
        {canOpenCreate ? (
          <div className="shrink-0">
            <button
              type="button"
              tabIndex={0}
              aria-label={`Add another assignee to ${activityName} on ${projectName}`}
              onClick={() =>
                onCellAssign({
                  activityId: row.activityId,
                  activityName: row.activityName,
                  projectId: col.projectId,
                  projectName: col.projectName,
                  subProjectId: subId,
                })
              }
              className={addStripClass}
            >
              + Add assignment
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (showEmptyAdd) {
    return (
      <div
        className={`${shiftBoardMatrixProjectCellGroupClass} min-h-0 border-border/30`}
        style={{ minHeight: rowMinPx, backgroundColor: cellBg, borderLeftColor: borderL }}
        aria-label={`${activityName} on ${col.projectName}`}
      >
        <button
          type="button"
          className="relative box-border flex w-full min-w-0 flex-1 flex-col items-stretch p-0 text-left outline-none"
          style={{ minHeight: rowMinPx }}
          onClick={() =>
            onCellAssign({
              activityId: row.activityId,
              activityName: row.activityName,
              projectId: col.projectId,
              projectName: col.projectName,
              subProjectId: subId,
            })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCellAssign({
                activityId: row.activityId,
                activityName: row.activityName,
                projectId: col.projectId,
                projectName: col.projectName,
                subProjectId: subId,
              });
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

  return null;
}

function gridColTemplate(
  nProjects: number,
): {
  style: { gridTemplateColumns: string; minWidth: string };
} {
  const w = `${LEFT_COL_W + nProjects * COL_MIN_PX}px`;
  return {
    style: {
      minWidth: w,
      gridTemplateColumns: `${LEFT_COL_W}px repeat(${nProjects}, minmax(${COL_MIN_PX}px, 1fr))`,
    },
  };
}

export function ShiftBoardMatrix({
  board,
  search,
  onCellAssign,
  onAssignmentClick,
}: {
  board: ShiftBoardResponseDto;
  search: string;
  onCellAssign: (ctx: {
    activityId: number;
    activityName: string;
    projectId: number;
    projectName: string;
    subProjectId: number;
  }) => void;
  onAssignmentClick: (a: ShiftBoardAssignmentDto) => void;
}): JSX.Element {
  const [openDepts, setOpenDepts] = useState<Set<number>>(
    () => new Set(board.rows.map((r) => r.departmentId)),
  );

  const filteredRows = useMemo(
    () => board.rows.filter((r) => rowMatchesFilter(search, r)),
    [board.rows, search],
  );

  const groups = useMemo(() => {
    const g = groupRows(filteredRows);
    return g.filter((x) => x.rows.length > 0);
  }, [filteredRows]);

  const cellMap = useMemo(() => {
    const m = new Map<string, ShiftBoardAssignmentDto[]>();
    for (const a of board.assignments) {
      const k = `${a.activityId}-${a.projectId}`;
      const list = m.get(k) ?? [];
      list.push(a);
      m.set(k, list);
    }
    for (const [, list] of Array.from(m.entries())) {
      list.sort((x, y) => {
        const fn = x.firstName.localeCompare(y.firstName);
        if (fn !== 0) {
          return fn;
        }
        return x.lastName.localeCompare(y.lastName);
      });
    }
    return m;
  }, [board.assignments]);

  const subMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const c of board.cells) {
      m.set(`${c.activityId}-${c.projectId}`, c.subProjectId);
    }
    return m;
  }, [board.cells]);

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

  if (board.cols.length === 0 || board.rows.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No projects or activities match the current filters.
      </p>
    );
  }

  const n = board.cols.length;
  const { style: tableGridStyle } = gridColTemplate(n);
  const hasRowMatches = groups.length > 0;

  return (
    <div className="overflow-x-auto rounded-input border border-border">
      <div
        className="grid w-full"
        style={tableGridStyle}
      >
        <div
          className={`${shiftBoardTableHeaderClass} ${shiftBoardMatrixStickyFirstColClass} z-[35]`}
        >
          Department / Activity
        </div>
        {board.cols.map((c) => {
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
                    className={`${shiftBoardGroupRowClass} ${shiftBoardMatrixStickyFirstColClass} z-[32]`}
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
                  {board.cols.map((col) => {
                    const hex = getProjectColor(col.colorKey);
                    return (
                      <div
                        key={`d-${g.departmentId}-${col.projectId}`}
                        className="box-border border-b border-l border-border/40 h-11 min-h-11"
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
                    ? g.rows.map((row) => {
                        const perCol = board.cols.map((col) => {
                          const key = `${row.activityId}-${col.projectId}`;
                          return {
                            assignmentCount: (cellMap.get(key) ?? []).length,
                            subProjectId: subMap.get(key) ?? null,
                          };
                        });
                        const rowMinPx = shiftBoardMatrixRowMinHeightPx(perCol);
                        return (
                        <Fragment key={`${row.departmentId}-${row.activityId}`}>
                          <div
                            className={`${shiftBoardMatrixStickyFirstColClass} z-[32] box-border flex items-center border-b border-r border-border bg-surface pl-1 pr-2 text-sm leading-snug text-text-primary`}
                            style={{ minHeight: rowMinPx }}
                          >
                            <span className="w-4 shrink-0" aria-hidden />
                            <span className="line-clamp-4 min-w-0 flex-1 [overflow-wrap:anywhere]">
                              {row.activityName}
                            </span>
                          </div>
                          {board.cols.map((col) => {
                            const k = `${row.activityId}-${col.projectId}`;
                            const subId = subMap.get(k) ?? null;
                            const list = cellMap.get(k) ?? [];
                            const hex = getProjectColor(col.colorKey);
                            return (
                              <MatrixProjectCell
                                key={k}
                                subId={subId}
                                list={list}
                                rowMinPx={rowMinPx}
                                hex={hex}
                                projectName={col.projectName}
                                activityName={row.activityName}
                                row={row}
                                col={col}
                                onCellAssign={onCellAssign}
                                onAssignmentClick={onAssignmentClick}
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
                  className={`${shiftBoardEmptySearchRowClass} ${shiftBoardMatrixStickyFirstColClass} z-[32]`}
                >
                  <span className="w-4 shrink-0" aria-hidden />
                  <span>No activities match the current search.</span>
                </div>
                {board.cols.map((col) => {
                  const hex = getProjectColor(col.colorKey);
                  return (
                    <div
                      key={`empty-l-${col.projectId}`}
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
