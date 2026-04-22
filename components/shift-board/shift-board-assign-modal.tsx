"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import type { ShiftBoardResponseDto } from "@/lib/shift-board-dto";

const MINUTES_CHOICES = [0, 15, 30, 45] as const;
const MAX_SHIFT_H = 8;

type ModalCtx = {
  activityId: number;
  activityName: string;
  projectId: number;
  projectName: string;
  subProjectId: number;
};

function snapQuarterHours(h: number): number {
  return Math.round(h * 100) / 100;
}

export function ShiftBoardAssignModal({
  open,
  onClose,
  context,
  board,
  onSubmit,
  error,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  context: ModalCtx | null;
  board: ShiftBoardResponseDto | null;
  onSubmit: (payload: {
    empId: string;
    durationHours: number;
  }) => Promise<void>;
  error: string | null;
  submitting: boolean;
}): JSX.Element | null {
  const titleId = useId();
  const [empId, setEmpId] = useState("");
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState<0 | 15 | 30 | 45>(0);

  const empOptions = useMemo(() => {
    if (!context || !board) {
      return [] as { value: string; label: string }[];
    }
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
  }, [board, context]);

  const existingForEmpH = useMemo(() => {
    if (!empId || !board) {
      return 0;
    }
    let t = 0;
    for (const a of board.assignments) {
      if (a.empId === empId) {
        t += Number(a.durationHours);
      }
    }
    return t;
  }, [board, empId]);

  const newH = useMemo(
    () => snapQuarterHours(hours + minutes / 60),
    [hours, minutes],
  );

  const over = existingForEmpH + newH > MAX_SHIFT_H + 1e-6;

  useEffect(() => {
    if (open) {
      setEmpId("");
      setHours(1);
      setMinutes(0);
    }
  }, [open, context?.activityId, context?.projectId]);

  const totalPlannedH = useMemo(
    () => existingForEmpH + (over ? 0 : newH),
    [existingForEmpH, newH, over],
  );

  const fillPct = useMemo(
    () => Math.min(100, (totalPlannedH / MAX_SHIFT_H) * 100),
    [totalPlannedH],
  );

  const savedPct = useMemo(() => {
    if (totalPlannedH <= 1e-9) {
      return 0;
    }
    return (existingForEmpH / totalPlannedH) * 100;
  }, [existingForEmpH, totalPlannedH]);

  const newPct = useMemo(
    () => (totalPlannedH <= 1e-9 ? 0 : 100 - savedPct),
    [totalPlannedH, savedPct],
  );

  const onSubmitForm = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!empId || over) {
        return;
      }
      void onSubmit({ empId, durationHours: newH });
    },
    [empId, newH, onSubmit, over],
  );

  if (!open || !context) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-base font-semibold text-text-primary"
        >
          Assign employees
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {context.projectName} · {context.activityName}
        </p>

        {empOptions.length === 0 ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            No qualified workers available for this activity, or the cell is
            full.
          </p>
        ) : null}

        <form className="mt-4 space-y-4" onSubmit={onSubmitForm}>
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
                style={{ width: `${fillPct}%` }}
              >
                {existingForEmpH + newH > 0 && !over ? (
                  <>
                    {existingForEmpH > 0 ? (
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${savedPct}%` }}
                        title="Existing assignments"
                      />
                    ) : null}
                    {newH > 0 ? (
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${newPct}%` }}
                        title="This assignment"
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-input border border-border bg-appbg px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!empId || over || empOptions.length === 0 || submitting}
              className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
