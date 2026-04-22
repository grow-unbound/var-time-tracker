"use client";

import { Fragment, useMemo, useState } from "react";

import { getProjectColor } from "@/lib/constants";
import type { ShiftBoardPersonResponseDto } from "@/lib/shift-board-dto";

function groupByDept(
  employees: ShiftBoardPersonResponseDto["employees"],
): { departmentName: string; rows: typeof employees }[] {
  const out: { departmentName: string; rows: typeof employees }[] = [];
  for (const e of employees) {
    const last = out[out.length - 1];
    if (last && last.rows[0]?.departmentName === e.departmentName) {
      last.rows.push(e);
    } else {
      out.push({ departmentName: e.departmentName, rows: [e] });
    }
  }
  return out;
}

export function ShiftBoardPerson({
  data,
  onRemoveAssignment,
}: {
  data: ShiftBoardPersonResponseDto;
  onRemoveAssignment: (assignmentId: number) => void;
}): JSX.Element {
  const [sort, setSort] = useState<"hours_desc" | "hours_asc" | "name">(
    "name",
  );

  const sorted = useMemo(() => {
    const list = [...data.employees];
    if (sort === "name") {
      list.sort(
        (a, b) =>
          a.departmentName.localeCompare(b.departmentName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.lastName.localeCompare(b.lastName),
      );
    } else if (sort === "hours_asc") {
      list.sort(
        (a, b) =>
          Number(a.totalHours) - Number(b.totalHours) ||
          a.firstName.localeCompare(b.firstName),
      );
    } else {
      list.sort(
        (a, b) =>
          Number(b.totalHours) - Number(a.totalHours) ||
          a.firstName.localeCompare(b.firstName),
      );
    }
    return list;
  }, [data.employees, sort]);

  const groups = useMemo(() => groupByDept(sorted), [sorted]);

  if (data.employees.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No employees to show.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-text-secondary">Sort by</span>
        <select
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as "hours_desc" | "hours_asc" | "name")
          }
          className="rounded-input border border-border bg-surface px-2 py-1 text-text-primary"
        >
          <option value="name">Name / Dept</option>
          <option value="hours_desc">Total hours (high → low)</option>
          <option value="hours_asc">Total hours (low → high)</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-input border border-border">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-appbg">
              <th className="px-2 py-2 font-medium text-text-primary">
                Employee
              </th>
              <th className="w-24 px-2 py-2 font-medium text-text-primary">
                Hours
              </th>
              <th className="px-2 py-2 font-medium text-text-primary">
                Assignments this shift
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.departmentName}>
                <tr className="bg-surface/80">
                  <td
                    colSpan={3}
                    className="border-b border-border px-2 py-1 font-medium text-text-primary"
                  >
                    {g.departmentName}
                  </td>
                </tr>
                {g.rows.map((e) => (
                  <tr key={e.empId} className="border-b border-border">
                    <td className="px-2 py-2 align-top text-text-primary">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="px-2 py-2 font-mono align-top text-text-primary">
                      {e.totalHours}h
                    </td>
                    <td className="px-2 py-2 align-top">
                      {e.isUnassigned ? (
                        <span className="text-text-secondary italic">
                          — unassigned —
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {e.assignments.map((x) => (
                            <button
                              key={x.assignmentId}
                              type="button"
                              onClick={() =>
                                onRemoveAssignment(x.assignmentId)
                              }
                              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2 py-0.5 text-left text-[11px] font-medium"
                              style={{
                                backgroundColor: `${getProjectColor(x.colorKey)}18`,
                                color: getProjectColor(x.colorKey),
                                borderColor: `${getProjectColor(x.colorKey)}55`,
                              }}
                              title="Remove assignment"
                            >
                              {x.projectCode} · {x.activityName} ·{" "}
                              {x.durationHours}h
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
