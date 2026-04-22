"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { ShiftBoardAssignModal } from "@/components/shift-board/shift-board-assign-modal";
import type { ShiftBoardAssignModalContext } from "@/components/shift-board/shift-board-assign-modal";
import { ShiftBoardFilters } from "@/components/shift-board/shift-board-filters";
import { ShiftBoardMatrix } from "@/components/shift-board/shift-board-matrix";
import { ShiftBoardPerson } from "@/components/shift-board/shift-board-person";
import {
  ShiftBoardMatrixSkeleton,
  ShiftBoardPersonSkeleton,
} from "@/components/shift-board/shift-board-skeletons";
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
  const boardRef = useRef<ShiftBoardResponseDto | null>(null);
  const personRef = useRef<ShiftBoardPersonResponseDto | null>(null);
  boardRef.current = board;
  personRef.current = person;

  const [assignCtx, setAssignCtx] = useState<ShiftBoardAssignModalContext | null>(
    null,
  );
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

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

  const loadViewData = useCallback(async (): Promise<void> => {
    if (shiftId == null) {
      return;
    }
    const blocking =
      boardRef.current == null ||
      (view === "person" && personRef.current == null);
    if (blocking) {
      setLoading(true);
    }
    setLoadError(null);
    const qM = buildShiftBoardQuery({
      dateYmd,
      shiftId,
      deptIds: selectedDeptIds,
      projectIds: selectedProjectIds,
    });
    try {
      const mRes = await fetch(`/api/shift-board?${qM}`, { cache: "no-store" });
      const mJson: unknown = await mRes.json();
      if (!mRes.ok) {
        const msg =
          typeof mJson === "object" &&
          mJson !== null &&
          "error" in mJson &&
          typeof (mJson as { error: string }).error === "string"
            ? (mJson as { error: string }).error
            : "Failed to load shift board";
        throw new Error(msg);
      }
      setBoard(mJson as ShiftBoardResponseDto);

      if (view === "person") {
        const qP = new URLSearchParams();
        qP.set("date", dateYmd);
        qP.set("shift", String(shiftId));
        if (selectedDeptIds.length > 0) {
          qP.set("depts", selectedDeptIds.join(","));
        }
        if (selectedProjectIds.length > 0) {
          qP.set("projects", selectedProjectIds.join(","));
        }
        const pRes = await fetch(
          `/api/shift-board/person-view?${qP.toString()}`,
          { cache: "no-store" },
        );
        const pJson: unknown = await pRes.json();
        if (!pRes.ok) {
          const msg =
            typeof pJson === "object" &&
            pJson !== null &&
            "error" in pJson &&
            typeof (pJson as { error: string }).error === "string"
              ? (pJson as { error: string }).error
              : "Failed to load person view";
          throw new Error(msg);
        }
        setPerson(pJson as ShiftBoardPersonResponseDto);
      } else {
        setPerson(null);
      }
    } catch (e) {
      setBoard(null);
      setPerson(null);
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [dateYmd, shiftId, selectedDeptIds, selectedProjectIds, view]);

  useEffect(() => {
    if (!shiftsReady || shiftId == null) {
      return;
    }
    void loadViewData();
  }, [shiftsReady, shiftId, loadViewData]);

  const onClearFilters = useCallback(() => {
    setSelectedDeptIds([]);
    setSelectedProjectIds([]);
  }, []);

  const refetchAfterMutation = useCallback(async (): Promise<void> => {
    await loadViewData();
  }, [loadViewData]);

  const submitCreate = useCallback(
    async (payload: {
      empId: string;
      durationHours: number;
      activityId: number;
      subProjectId: number;
    }) => {
      if (shiftId == null) {
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
            sub_project_id: payload.subProjectId,
            activity_id: payload.activityId,
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
        await refetchAfterMutation();
      } catch (e) {
        setAssignError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setAssignSubmitting(false);
      }
    },
    [dateYmd, shiftId, refetchAfterMutation],
  );

  const submitEdit = useCallback(
    async (payload: { assignmentId: number; durationHours: number }) => {
      setAssignSubmitting(true);
      setAssignError(null);
      try {
        const res = await fetch(
          `/api/shift-assignments/${payload.assignmentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ duration_hours: payload.durationHours }),
          },
        );
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
        await refetchAfterMutation();
      } catch (e) {
        setAssignError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setAssignSubmitting(false);
      }
    },
    [refetchAfterMutation],
  );

  const onRemove = useCallback(
    async (assignmentId: number) => {
      setRemoving(true);
      setAssignError(null);
      try {
        const res = await fetch(`/api/shift-assignments/${assignmentId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? "Delete failed");
        }
        setAssignCtx(null);
        await refetchAfterMutation();
      } catch (e) {
        setAssignError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setRemoving(false);
      }
    },
    [refetchAfterMutation],
  );

  const onMatrixCellAssign = useCallback(
    (ctx: {
      activityId: number;
      activityName: string;
      projectId: number;
      projectName: string;
      subProjectId: number;
    }) => {
      setAssignError(null);
      setAssignCtx({
        mode: "create",
        ...ctx,
      });
    },
    [],
  );

  const onMatrixAssignmentClick = useCallback(
    (a: ShiftBoardAssignmentDto) => {
      setAssignError(null);
      setAssignCtx({ mode: "edit", assignment: a });
    },
    [],
  );

  const skeletonProjectCount = useMemo(() => {
    if (selectedProjectIds.length > 0) {
      return selectedProjectIds.length;
    }
    if (projects.length > 0) {
      return projects.length;
    }
    return 5;
  }, [selectedProjectIds.length, projects.length]);

  return (
    <div className="space-y-4">
      <div className="w-full">
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

      {loadError ? (
        <div
          className="rounded-input border border-danger bg-danger-light px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      {loading && !board && view === "matrix" ? (
        <ShiftBoardMatrixSkeleton projectCount={skeletonProjectCount} />
      ) : null}
      {loading && view === "person" && !person ? (
        <ShiftBoardPersonSkeleton projectCount={skeletonProjectCount} />
      ) : null}

      {view === "matrix" && board && shiftId != null ? (
        <ShiftBoardMatrix
          board={board}
          search={search}
          onCellAssign={onMatrixCellAssign}
          onAssignmentClick={onMatrixAssignmentClick}
        />
      ) : null}

      {view === "person" && person && board && shiftId != null ? (
        <ShiftBoardPerson
          data={person}
          search={search}
          onCreateCell={(e) => {
            setAssignError(null);
            setAssignCtx({
              mode: "createPerson",
              empId: e.empId,
              firstName: e.firstName,
              lastName: e.lastName,
              departmentId: e.departmentId,
              projectId: e.projectId,
              projectName: e.projectName,
            });
          }}
          onEditAssignment={(_emp, a) => {
            setAssignError(null);
            setAssignCtx({
              mode: "editPerson",
              assignment: a,
              empId: _emp.empId,
              firstName: _emp.firstName,
              lastName: _emp.lastName,
            });
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
        onSubmitCreate={submitCreate}
        onSubmitEdit={submitEdit}
        onRemove={onRemove}
        error={assignError}
        submitting={assignSubmitting}
        removing={removing}
      />
    </div>
  );
}
