"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { ShiftBoardAssignModal } from "@/components/shift-board/shift-board-assign-modal";
import { ShiftBoardFilters } from "@/components/shift-board/shift-board-filters";
import { ShiftBoardMatrix } from "@/components/shift-board/shift-board-matrix";
import { ShiftBoardPerson } from "@/components/shift-board/shift-board-person";
import type { DepartmentDto, ProjectDto, ShiftDto } from "@/lib/api-dtos";
import { localYmd } from "@/lib/shift-board-date";
import type {
  ShiftBoardAssignmentDto,
  ShiftBoardPersonResponseDto,
  ShiftBoardResponseDto,
} from "@/lib/shift-board-dto";
import { defaultShiftIdFromTime } from "@/lib/shift-default";

function buildShiftBoardQuery(params: {
  dateYmd: string;
  shiftId: number;
  deptIds: number[];
  projectIds: number[];
}): string {
  const q = new URLSearchParams();
  q.set("date", params.dateYmd);
  q.set("shift", String(params.shiftId));
  if (params.deptIds.length > 0) {
    q.set("depts", params.deptIds.join(","));
  }
  if (params.projectIds.length > 0) {
    q.set("projects", params.projectIds.join(","));
  }
  return q.toString();
}

export function ShiftBoardPage(): JSX.Element {
  const baseId = useId();

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [shiftsReady, setShiftsReady] = useState(false);

  const [dateYmd, setDateYmd] = useState(() => localYmd());
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"matrix" | "person">("matrix");

  const [board, setBoard] = useState<ShiftBoardResponseDto | null>(null);
  const [person, setPerson] = useState<ShiftBoardPersonResponseDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [assignCtx, setAssignCtx] = useState<{
    activityId: number;
    activityName: string;
    projectId: number;
    projectName: string;
    subProjectId: number;
  } | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [confirmRemove, setConfirmRemove] = useState<{
    assignmentId: number;
    label: string;
  } | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [dRes, pRes, sRes] = await Promise.all([
          fetch("/api/departments", { cache: "no-store" }),
          fetch("/api/projects", { cache: "no-store" }),
          fetch("/api/shifts", { cache: "no-store" }),
        ]);
        if (!dRes.ok || !pRes.ok || !sRes.ok) {
          throw new Error("Failed to load filters");
        }
        const dJson = (await dRes.json()) as { departments: DepartmentDto[] };
        const pJson = (await pRes.json()) as { projects: ProjectDto[] };
        const sJson = (await sRes.json()) as { shifts: ShiftDto[] };
        if (cancelled) {
          return;
        }
        setDepartments(dJson.departments);
        setProjects(pJson.projects);
        const sh = [...sJson.shifts].sort((a, b) => a.id - b.id);
        setShifts(sh);
        setShiftId((prev) => {
          if (prev != null) {
            return prev;
          }
          return defaultShiftIdFromTime(new Date(), sh.map((x) => x.id));
        });
        setShiftsReady(true);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load filters",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchMatrix = useCallback(async (): Promise<void> => {
    if (shiftId == null) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const q = buildShiftBoardQuery({
        dateYmd,
        shiftId,
        deptIds: selectedDeptIds,
        projectIds: selectedProjectIds,
      });
      const res = await fetch(`/api/shift-board?${q}`, { cache: "no-store" });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof (json as { error: string }).error === "string"
            ? (json as { error: string }).error
            : "Failed to load shift board";
        throw new Error(msg);
      }
      setBoard(json as ShiftBoardResponseDto);
    } catch (e) {
      setBoard(null);
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [dateYmd, shiftId, selectedDeptIds, selectedProjectIds]);

  const refetchPerson = useCallback(async (): Promise<void> => {
    if (shiftId == null) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const q = new URLSearchParams();
      q.set("date", dateYmd);
      q.set("shift", String(shiftId));
      if (selectedDeptIds.length > 0) {
        q.set("depts", selectedDeptIds.join(","));
      }
      const res = await fetch(
        `/api/shift-board/person-view?${q.toString()}`,
        { cache: "no-store" },
      );
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof (json as { error: string }).error === "string"
            ? (json as { error: string }).error
            : "Failed to load person view";
        throw new Error(msg);
      }
      setPerson(json as ShiftBoardPersonResponseDto);
    } catch (e) {
      setPerson(null);
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [dateYmd, shiftId, selectedDeptIds]);

  useEffect(() => {
    if (!shiftsReady || shiftId == null) {
      return;
    }
    if (view === "matrix") {
      void refetchMatrix();
    } else {
      void refetchPerson();
    }
  }, [shiftsReady, shiftId, view, refetchMatrix, refetchPerson]);

  const onClearFilters = useCallback(() => {
    setSelectedDeptIds([]);
    setSelectedProjectIds([]);
  }, []);

  const submitAssign = useCallback(
    async (payload: { empId: string; durationHours: number }) => {
      if (assignCtx == null || shiftId == null) {
        return;
      }
      setAssignSubmitting(true);
      setAssignError(null);
      try {
        const res = await fetch("/api/shift-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emp_id: payload.empId,
            sub_project_id: assignCtx.subProjectId,
            activity_id: assignCtx.activityId,
            shift_date: dateYmd,
            shift_id: shiftId,
            duration_hours: payload.durationHours,
          }),
        });
        const json: unknown = await res.json();
        if (!res.ok) {
          const msg =
            typeof json === "object" &&
            json !== null &&
            "error" in json &&
            typeof (json as { error: string }).error === "string"
              ? (json as { error: string }).error
              : "Save failed";
          throw new Error(msg);
        }
        setAssignCtx(null);
        await refetchMatrix();
        if (view === "person") {
          await refetchPerson();
        }
      } catch (e) {
        setAssignError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setAssignSubmitting(false);
      }
    },
    [assignCtx, dateYmd, shiftId, refetchMatrix, refetchPerson, view],
  );

  const doDelete = useCallback(
    async (assignmentId: number) => {
      setRemoveSubmitting(true);
      try {
        const res = await fetch(`/api/shift-assignments/${assignmentId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? "Delete failed");
        }
        setConfirmRemove(null);
        await refetchMatrix();
        if (view === "person") {
          await refetchPerson();
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setRemoveSubmitting(false);
      }
    },
    [refetchMatrix, refetchPerson, view],
  );

  const onRemoveChip = useCallback((a: ShiftBoardAssignmentDto) => {
    setConfirmRemove({
      assignmentId: a.assignmentId,
      label: `${a.firstName} ${a.lastName} — ${a.durationHours}h`,
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <header className="min-w-0 flex-1 lg:max-w-[50%]">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            Production Planning
          </p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-text-primary">
            Shift board
          </h1>
        </header>
        <div className="w-full lg:ml-auto lg:max-w-[100%]">
          <div className="rounded-card border border-border bg-surface p-3 shadow-card">
            <ShiftBoardFilters
              baseId={baseId}
              dateYmd={dateYmd}
              onDateYmd={setDateYmd}
              shifts={shifts}
              shiftId={shiftId}
              onShiftId={setShiftId}
              departments={departments}
              projects={projects}
              selectedDeptIds={selectedDeptIds}
              selectedProjectIds={selectedProjectIds}
              onDeptChange={setSelectedDeptIds}
              onProjectChange={setSelectedProjectIds}
              search={search}
              onSearch={setSearch}
              onClearFilters={onClearFilters}
              view={view}
              onView={setView}
            />
          </div>
        </div>
      </div>

      {loadError ? (
        <div
          className="rounded-input border border-danger bg-danger-light px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      {loading && !board && view === "matrix" ? (
        <p className="text-xs text-text-secondary">Loading…</p>
      ) : null}
      {loading && !person && view === "person" ? (
        <p className="text-xs text-text-secondary">Loading…</p>
      ) : null}

      {view === "matrix" && board && shiftId != null ? (
        <ShiftBoardMatrix
          board={board}
          search={search}
          onAssign={setAssignCtx}
          onRemoveChip={onRemoveChip}
        />
      ) : null}

      {view === "person" && person && shiftId != null ? (
        <ShiftBoardPerson
          data={person}
          onRemoveAssignment={(assignmentId) => {
            setConfirmRemove({ assignmentId, label: "this assignment" });
          }}
        />
      ) : null}

      <ShiftBoardAssignModal
        open={assignCtx != null}
        onClose={() => {
          setAssignCtx(null);
          setAssignError(null);
        }}
        context={assignCtx}
        board={board}
        onSubmit={submitAssign}
        error={assignError}
        submitting={assignSubmitting}
      />

      {confirmRemove ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-title"
        >
          <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-lg">
            <h2
              id="confirm-remove-title"
              className="text-base font-semibold text-text-primary"
            >
              Remove assignment?
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {confirmRemove.label}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="rounded-input border border-border bg-appbg px-4 py-2 text-sm"
                disabled={removeSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void doDelete(confirmRemove.assignmentId)}
                className="rounded-input bg-danger px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={removeSubmitting}
              >
                {removeSubmitting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
