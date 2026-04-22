"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { MAX_SHIFT_HOURS } from "@/lib/shift-board-constants";
import type {
  ShiftBoardAssignmentDto,
  ShiftBoardPersonAssignmentDto,
  ShiftBoardResponseDto,
} from "@/lib/shift-board-dto";

const MINUTES_CHOICES = [0, 15, 30, 45] as const;
const MAX_SHIFT_H = MAX_SHIFT_HOURS;

function snapQuarterHours(h: number): number {
  return Math.round(h * 100) / 100;
}

function parseDurationToParts(
  hoursStr: string,
): { h: number; m: 0 | 15 | 30 | 45 } {
  const n = Number(hoursStr);
  if (!Number.isFinite(n)) {
    return { h: 1, m: 0 };
  }
  const totalM = Math.round(n * 60);
  const h = Math.floor(totalM / 60);
  const mRaw = totalM % 60;
  const m = (MINUTES_CHOICES as readonly number[]).includes(mRaw)
    ? (mRaw as 0 | 15 | 30 | 45)
    : 0;
  return { h: Math.min(8, Math.max(0, h)), m };
}

export type ShiftBoardAssignModalContext =
  | {
      mode: "create";
      activityId: number;
      activityName: string;
      projectId: number;
      projectName: string;
      subProjectId: number;
    }
  | {
      mode: "createPerson";
      empId: string;
      firstName: string;
      lastName: string;
      departmentId: number;
      projectId: number;
      projectName: string;
    }
  | { mode: "edit"; assignment: ShiftBoardAssignmentDto }
  | {
      mode: "editPerson";
      assignment: ShiftBoardPersonAssignmentDto;
      empId: string;
      firstName: string;
      lastName: string;
    };

export function ShiftBoardAssignModal({
  open,
  onClose,
  context,
  board,
  onSubmitCreate,
  onSubmitEdit,
  onRemove,
  error,
  submitting,
  removing,
}: {
  open: boolean;
  onClose: () => void;
  context: ShiftBoardAssignModalContext | null;
  board: ShiftBoardResponseDto | null;
  onSubmitCreate: (payload: {
    empId: string;
    durationHours: number;
    activityId: number;
    subProjectId: number;
  }) => Promise<void>;
  onSubmitEdit: (payload: {
    assignmentId: number;
    durationHours: number;
  }) => Promise<void>;
  onRemove: (assignmentId: number) => Promise<void>;
  error: string | null;
  submitting: boolean;
  removing: boolean;
}): JSX.Element | null {
  const titleId = useId();
  const [empId, setEmpId] = useState("");
  const [activityIdCreate, setActivityIdCreate] = useState<number | "">("");
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState<0 | 15 | 30 | 45>(0);

  const personActivityOptions = useMemo(() => {
    if (!context || context.mode !== "createPerson" || !board) {
      return [] as { activityId: number; activityName: string; subProjectId: number }[];
    }
    const out: {
      activityId: number;
      activityName: string;
      subProjectId: number;
    }[] = [];
    for (const row of board.rows) {
      if (row.departmentId !== context.departmentId) {
        continue;
      }
      const cell = board.cells.find(
        (c) => c.activityId === row.activityId && c.projectId === context.projectId,
      );
      if (cell?.subProjectId == null) {
        continue;
      }
      out.push({
        activityId: row.activityId,
        activityName: row.activityName,
        subProjectId: cell.subProjectId,
      });
    }
    out.sort((a, b) => a.activityName.localeCompare(b.activityName));
    return out.filter(
      (o) =>
        !board.assignments.some(
          (a) =>
            a.empId === context.empId &&
            a.activityId === o.activityId &&
            a.projectId === context.projectId,
        ),
    );
  }, [board, context]);

  const empOptions = useMemo(() => {
    if (!context || !board) {
      return [] as { value: string; label: string }[];
    }
    if (context.mode === "create") {
      const inCell = new Set(
        board.assignments
          .filter(
            (a) =>
              a.activityId === context.activityId &&
              a.projectId === context.projectId,
          )
          .map((a) => a.empId),
      );
      return board.qualifications
        .filter((q) => q.validActivityIds.includes(context.activityId))
        .filter(
          (q) =>
            q.departmentId ===
            board.rows.find((r) => r.activityId === context.activityId)
              ?.departmentId,
        )
        .filter((q) => !inCell.has(q.empId))
        .map((q) => ({
          value: q.empId,
          label: `${q.firstName} ${q.lastName}`,
        }));
    }
    return [];
  }, [board, context]);

  const personCreateAct = useMemo(() => {
    if (context?.mode !== "createPerson" || activityIdCreate === "" || !board) {
      return null;
    }
    return personActivityOptions.find(
      (o) => o.activityId === activityIdCreate,
    ) ?? null;
  }, [context, activityIdCreate, board, personActivityOptions]);

  const personCreateQualified = useMemo(() => {
    if (context?.mode !== "createPerson" || !board || !personCreateAct) {
      return true;
    }
    const q = board.qualifications.find(
      (x) => x.empId === context.empId,
    );
    if (!q?.validActivityIds.includes(personCreateAct.activityId)) {
      return false;
    }
    const dup = board.assignments.some(
      (a) =>
        a.empId === context.empId &&
        a.activityId === personCreateAct.activityId &&
        a.projectId === context.projectId,
    );
    return !dup;
  }, [board, context, personCreateAct]);

  const selectedEmpForNew = useMemo(() => {
    if (context?.mode === "createPerson" && context.empId) {
      return context.empId;
    }
    return empId;
  }, [context, empId]);

  const existingForEmpH = useMemo(() => {
    if (!board) {
      return 0;
    }
    if (context?.mode === "edit" || context?.mode === "editPerson") {
      const targetEmp =
        context.mode === "edit"
          ? context.assignment.empId
          : context.empId;
      let t = 0;
      for (const a of board.assignments) {
        if (a.empId === targetEmp) {
          if (a.assignmentId === context.assignment.assignmentId) {
            continue;
          }
          t += Number(a.durationHours);
        }
      }
      return t;
    }
    if (!selectedEmpForNew) {
      return 0;
    }
    let t = 0;
    for (const a of board.assignments) {
      if (a.empId === selectedEmpForNew) {
        t += Number(a.durationHours);
      }
    }
    return t;
  }, [board, context, selectedEmpForNew]);

  const newH = useMemo(
    () => snapQuarterHours(hours + minutes / 60),
    [hours, minutes],
  );

  const over = existingForEmpH + newH > MAX_SHIFT_H + 1e-6;

  useEffect(() => {
    if (open && context) {
      if (context.mode === "create") {
        setEmpId("");
        setActivityIdCreate("");
        setHours(1);
        setMinutes(0);
      } else if (context.mode === "createPerson") {
        setActivityIdCreate("");
        setHours(1);
        setMinutes(0);
      } else if (context.mode === "edit") {
        const p = parseDurationToParts(context.assignment.durationHours);
        setHours(p.h);
        setMinutes(p.m);
      } else {
        const p = parseDurationToParts(context.assignment.durationHours);
        setHours(p.h);
        setMinutes(p.m);
      }
    }
  }, [open, context]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const onSubmitForm = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!context) {
        return;
      }
      if (context.mode === "create") {
        if (!empId || over) {
          return;
        }
        await onSubmitCreate({
          empId,
          durationHours: newH,
          activityId: context.activityId,
          subProjectId: context.subProjectId,
        });
        return;
      }
      if (context.mode === "createPerson") {
        const act = personActivityOptions.find(
          (o) => o.activityId === activityIdCreate,
        );
        if (!act || over) {
          return;
        }
        await onSubmitCreate({
          empId: context.empId,
          durationHours: newH,
          activityId: act.activityId,
          subProjectId: act.subProjectId,
        });
        return;
      }
      if (context.mode === "edit" || context.mode === "editPerson") {
        if (over) {
          return;
        }
        await onSubmitEdit({
          assignmentId: context.assignment.assignmentId,
          durationHours: newH,
        });
      }
    },
    [
      context,
      empId,
      newH,
      onSubmitCreate,
      onSubmitEdit,
      over,
      personActivityOptions,
      activityIdCreate,
    ],
  );

  const matrixEditActivity = useMemo(() => {
    if (!context || context.mode !== "edit" || !board) {
      return null;
    }
    return (
      board.rows.find(
        (r) => r.activityId === context.assignment.activityId,
      )?.activityName ?? "Activity"
    );
  }, [context, board]);

  if (!open || !context) {
    return null;
  }

  const isEdit = context.mode === "edit" || context.mode === "editPerson";
  const title = isEdit ? "Edit assignment" : "Assign employees";
  const subline =
    context.mode === "create"
      ? `${context.projectName} · ${context.activityName}`
      : context.mode === "createPerson"
        ? `${context.projectName} · ${context.firstName} ${context.lastName}`
        : context.mode === "edit"
          ? `${context.assignment.firstName} ${context.assignment.lastName} — ${matrixEditActivity ?? "Activity"} (edit)`
          : `${context.firstName} ${context.lastName} — ${context.assignment.activityName} (edit)`;

  const canSubmitCreate =
    context.mode === "create"
      ? Boolean(empId) && !over && empOptions.length > 0
      : context.mode === "createPerson"
        ? activityIdCreate !== "" && !over && personCreateQualified
        : false;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-base font-semibold text-text-primary"
        >
          {title}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">{subline}</p>

        {context.mode === "create" && empOptions.length === 0 ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            No qualified workers available for this activity, or the cell is
            full.
          </p>
        ) : null}

        {context.mode === "createPerson" && personActivityOptions.length === 0 ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            No activities for this project in this employee&apos;s department.
          </p>
        ) : null}

        {context.mode === "createPerson" && activityIdCreate !== "" && !personCreateQualified ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            This employee is not qualified for the selected activity, or
            already has this assignment.
          </p>
        ) : null}

        <form className="mt-4 space-y-4" onSubmit={onSubmitForm}>
          {context.mode === "createPerson" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Activity
              </label>
              <select
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm"
                value={activityIdCreate === "" ? "" : String(activityIdCreate)}
                onChange={(e) => {
                  const v = e.target.value;
                  setActivityIdCreate(v === "" ? "" : Number(v));
                }}
                required
              >
                <option value="">Select activity…</option>
                {personActivityOptions.map((o) => (
                  <option key={o.activityId} value={o.activityId}>
                    {o.activityName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {context.mode === "create" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Employee
              </label>
              <select
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {empOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {(isEdit ||
            (context.mode === "createPerson" && activityIdCreate !== "")) && (
            <>
              {context.mode === "createPerson" && activityIdCreate !== "" ? (
                <p className="text-sm text-text-primary">
                  Employee: {context.firstName} {context.lastName}
                </p>
              ) : null}
              {isEdit && context.mode === "edit" ? (
                <p className="text-sm text-text-primary">
                  {context.assignment.firstName} {context.assignment.lastName}{" "}
                  {matrixEditActivity ? (
                    <span className="text-text-secondary">
                      ({matrixEditActivity})
                    </span>
                  ) : null}
                </p>
              ) : null}
              {isEdit && context.mode === "editPerson" ? (
                <p className="text-sm text-text-primary">
                  {context.firstName} {context.lastName}{" "}
                  <span className="text-text-secondary">
                    ({context.assignment.activityName})
                  </span>
                </p>
              ) : null}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Hours
              </label>
              <select
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              >
                {Array.from({ length: 9 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Minutes
              </label>
              <select
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm"
                value={minutes}
                onChange={(e) =>
                  setMinutes(Number(e.target.value) as 0 | 15 | 30 | 45)
                }
              >
                {MINUTES_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m}m
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs text-text-secondary">Load this shift</div>
            <div
              className={`mt-1 h-2 w-full overflow-hidden rounded border border-border ${
                over ? "ring-2 ring-danger" : ""
              }`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={MAX_SHIFT_H * 60}
              aria-valuenow={Math.round(
                (existingForEmpH + (over ? 0 : newH)) * 60,
              )}
            >
              <div
                className="flex h-full w-full transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.min(
                    100,
                    ((existingForEmpH + (over ? 0 : newH)) / MAX_SHIFT_H) * 100,
                  )}%`,
                }}
              >
                {existingForEmpH + (over ? 0 : newH) > 0 && !over ? (
                  <>
                    {existingForEmpH > 0 && !isEdit ? (
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${(existingForEmpH / (existingForEmpH + newH)) * 100}%`,
                        }}
                        title="Other assignments this shift"
                      />
                    ) : null}
                    {newH > 0 && !isEdit ? (
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: isEdit
                            ? "100%"
                            : existingForEmpH + newH > 0
                              ? `${(newH / (existingForEmpH + newH)) * 100}%`
                              : "0%",
                        }}
                        title="This block"
                      />
                    ) : null}
                    {isEdit && newH > 0 ? (
                      <div
                        className="h-full w-full bg-accent"
                        title="Updated duration"
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            <p className="mt-1 font-mono text-xs text-text-primary">
              {(existingForEmpH + (over ? 0 : newH)).toFixed(2)}h / {MAX_SHIFT_H}h
            </p>
            {over ? (
              <p className="mt-1 text-xs text-danger">
                Exceeds 8 hours for this shift.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={() =>
                  void onRemove(context.assignment.assignmentId)
                }
                disabled={removing || submitting}
                className="mr-auto rounded-input border border-danger bg-danger/10 px-4 py-2 text-sm font-medium text-danger"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-input border border-border bg-appbg px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                (context.mode === "create" && !canSubmitCreate) ||
                (context.mode === "createPerson" && !canSubmitCreate) ||
                (isEdit && over) ||
                (context.mode === "createPerson" && personActivityOptions.length === 0)
              }
              className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Save" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
