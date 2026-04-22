"use client";

import { Fragment, useCallback, useMemo, useState } from "react";

import { getProjectColor } from "@/lib/constants";
import { getDepartmentChipStyle } from "@/lib/shift-board-styles";
import type {
  ShiftBoardAssignmentDto,
  ShiftBoardResponseDto,
} from "@/lib/shift-board-dto";

function initials(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function groupRows(
  rows: ShiftBoardResponseDto["rows"],
): { departmentId: number; departmentName: string; rows: typeof rows }[] {
  const out: { departmentId: number; departmentName: string; rows: typeof rows }[] =
    [];
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

function matchesEmployeeSearch(
  q: string,
  a: ShiftBoardAssignmentDto,
): boolean {
  if (!q.trim()) {
    return true;
  }
  const t = q.trim().toLowerCase();
  return (
    a.firstName.toLowerCase().includes(t) ||
    a.lastName.toLowerCase().includes(t) ||
    `${a.firstName} ${a.lastName}`.toLowerCase().includes(t)
  );
}

export function ShiftBoardMatrix({
  board,
  search,
  onAssign,
  onRemoveChip,
}: {
  board: ShiftBoardResponseDto;
  search: string;
  onAssign: (ctx: {
    activityId: number;
    activityName: string;
    projectId: number;
    projectName: string;
    subProjectId: number;
  }) => void;
  onRemoveChip: (a: ShiftBoardAssignmentDto) => void;
}): JSX.Element {
  const [openDepts, setOpenDepts] = useState<Set<number>>(
    () => new Set(board.rows.map((r) => r.departmentId)),
  );

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

  const mayNeed = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of board.cells) {
      m.set(
        `${c.activityId}-${c.projectId}`,
        c.mayNeedCoverage && c.subProjectId != null,
      );
    }
    return m;
  }, [board.cells]);

  const groups = useMemo(() => groupRows(board.rows), [board.rows]);

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

  return (
    <div className="overflow-x-auto rounded-input border border-border">
      <table className="w-max min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-appbg">
            <th className="sticky left-0 z-10 min-w-[200px] border-b border-r border-border bg-appbg px-2 py-2 font-medium text-text-primary">
              Dept / Activity
            </th>
            {board.cols.map((c) => (
              <th
                key={c.projectId}
                className="min-w-[120px] border-b border-border px-2 py-2 text-center font-medium"
                style={{
                  color: getProjectColor(c.colorKey),
                  borderBottomColor: getProjectColor(c.colorKey),
                }}
              >
                <span className="block text-[11px] text-text-secondary">
                  {c.projectCode}
                </span>
                <span className="line-clamp-2 text-text-primary">
                  {c.projectName}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const isOpen = openDepts.has(g.departmentId);
            return (
              <Fragment key={g.departmentId}>
                <tr className="bg-surface/80">
                  <td
                    colSpan={board.cols.length + 1}
                    className="border-b border-border px-2 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDept(g.departmentId)}
                      className="inline-flex w-full items-center gap-1 text-left font-medium text-text-primary"
                    >
                      <span className="text-text-secondary" aria-hidden>
                        {isOpen ? "▼" : "▶"}
                      </span>
                      {g.departmentName}
                    </button>
                  </td>
                </tr>
                {isOpen
                  ? g.rows.map((row) => (
                      <tr
                        key={`${row.departmentId}-${row.activityId}`}
                        className="border-b border-border"
                      >
                        <td className="sticky left-0 z-10 min-w-[200px] border-r border-border bg-surface px-2 py-2 text-text-primary">
                          {row.activityName}
                        </td>
                        {board.cols.map((col) => {
                          const k = `${row.activityId}-${col.projectId}`;
                          const subId = subMap.get(k) ?? null;
                          const list = cellMap.get(k) ?? [];
                          const empty = list.length === 0;
                          const needFlag =
                            empty &&
                            (mayNeed.get(k) ?? false) &&
                            subId != null;

                          return (
                            <td
                              key={k}
                              className="align-top border-l border-border px-1.5 py-1.5"
                            >
                              <div
                                className={`group relative min-h-[40px] rounded-input p-1 ${
                                  subId == null
                                    ? "bg-border/20"
                                    : "bg-surface"
                                }`}
                              >
                                {subId == null ? (
                                  <span className="text-[10px] text-text-secondary">
                                    —
                                  </span>
                                ) : (
                                  <>
                                    <div className="flex flex-wrap gap-1">
                                      {list.map((a) => {
                                        const hit = matchesEmployeeSearch(
                                          search,
                                          a,
                                        );
                                        return (
                                          <button
                                            key={a.assignmentId}
                                            type="button"
                                            onClick={() => onRemoveChip(a)}
                                            className={`inline-flex max-w-full items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[11px] font-medium transition-opacity ${
                                              search.trim() && !hit
                                                ? "opacity-30"
                                                : "opacity-100"
                                            } ${hit && search.trim() ? "ring-1 ring-accent" : ""}`}
                                            style={getDepartmentChipStyle(
                                              a.departmentId,
                                            )}
                                            title={
                                              Number(
                                                a.assignmentCountForEmployee,
                                              ) > 4
                                                ? "Multiple assignments this shift (review load)"
                                                : `${a.firstName} ${a.lastName} · ${a.durationHours}h`
                                            }
                                          >
                                            <span
                                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/50 text-[9px] font-bold"
                                              aria-hidden
                                            >
                                              {initials(
                                                a.firstName,
                                                a.lastName,
                                              )}
                                            </span>
                                            <span className="truncate">
                                              {a.firstName} · {a.durationHours}h
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {list.length === 0 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onAssign({
                                            activityId: row.activityId,
                                            activityName: row.activityName,
                                            projectId: col.projectId,
                                            projectName: col.projectName,
                                            subProjectId: subId,
                                          })
                                        }
                                        className="mt-1 w-full rounded-input border border-border bg-appbg py-1 text-[10px] font-medium text-primary hover:bg-white"
                                      >
                                        Assign employees
                                      </button>
                                    ) : (
                                      <div className="pointer-events-none absolute inset-0 flex items-end justify-end opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onAssign({
                                              activityId: row.activityId,
                                              activityName: row.activityName,
                                              projectId: col.projectId,
                                              projectName: col.projectName,
                                              subProjectId: subId,
                                            })
                                          }
                                          className="mb-0.5 mr-0.5 rounded-input bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                                        >
                                          Assign
                                        </button>
                                      </div>
                                    )}
                                    {needFlag ? (
                                      <span
                                        className="mt-0.5 block text-[9px] text-amber-700"
                                        title="No one assigned; sub-project active"
                                      >
                                        Uncovered
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
