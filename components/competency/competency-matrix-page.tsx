"use client";

import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SearchableMultiSelect } from "@/components/dashboard/searchable-multi-select";
import { CompetencyStatusMultiSelect } from "@/components/competency/competency-status-multi-select";
import { MetricStatCard } from "@/components/ui/metric-stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CompetencyMatrixActivityDto,
  CompetencyMatrixCellDto,
  CompetencyMatrixResponseDto,
  CompetencyMatrixWorkerDto,
  CompetencyKpisResponseDto,
  CompetencyStatusToken,
} from "@/lib/competency-types";
import {
  getCompetencyDateContext,
  isExpired,
  isExpiringSoon,
  isQualifiedLevel,
  ymdToUtcDate,
} from "@/lib/competency-utils";

const ROW_LIMITS = [10, 20, 50, 100] as const;

/** Fixed width for each activity column (table-fixed + horizontal scroll). */
const ACTIVITY_COL_WIDTH_PX = 96;

/** Employee name column: fixed width; table uses `w-max` so this does not grow when few activities are shown. */
const EMPLOYEE_NAME_COL_WIDTH = "13rem";

/** Initial load skeleton: column count and department header spans (sum = activity cols). */
const SKELETON_MATRIX_ACTIVITY_COLS = 10;
const SKELETON_MATRIX_ROWS = 8;
const SKELETON_DEPT_COL_SPANS: readonly number[] = [4, 3, 3];

type CellVisual = "empty" | "notQualified" | "qualified" | "expired" | "expiring";

function getCellVisual(
  cell: CompetencyMatrixCellDto | undefined,
  ctx: ReturnType<typeof getCompetencyDateContext>,
): CellVisual {
  if (!cell || cell.level === null) {
    return "empty";
  }
  if (cell.level === 0) {
    return "notQualified";
  }
  if (!isQualifiedLevel(cell.level)) {
    return "empty";
  }
  const exp =
    cell.expiryDate === null ? null : ymdToUtcDate(cell.expiryDate);
  if (exp !== null && isExpired(exp, ctx.todayStart)) {
    return "expired";
  }
  if (isExpiringSoon(cell.level, exp, ctx)) {
    return "expiring";
  }
  return "qualified";
}

function matrixCellTone(visual: CellVisual): string {
  switch (visual) {
    case "empty":
      return "bg-surface text-text-secondary";
    case "notQualified":
      return "bg-[#E8EFF7] text-primary";
    case "qualified":
      return "bg-[#D6E8F8] text-primary";
    case "expired":
      return "bg-danger-light text-danger";
    case "expiring":
      return "bg-accent-light text-text-primary";
    default:
      return "bg-surface";
  }
}

function legendCellClass(visual: CellVisual): string {
  const base =
    "inline-flex h-6 w-8 items-center justify-center rounded border border-border text-xs";
  return `${base} ${matrixCellTone(visual)}`;
}

function cellSymbol(visual: CellVisual): string {
  switch (visual) {
    case "notQualified":
      return "\u2717";
    case "qualified":
      return "\u2713";
    case "expired":
      return "!";
    case "expiring":
      return "\u2713!";
    default:
      return "";
  }
}

interface DeptActivityGroup {
  department: CompetencyMatrixResponseDto["departments"][number];
  activities: CompetencyMatrixResponseDto["activities"];
}

function buildActivityGroups(
  departments: CompetencyMatrixResponseDto["departments"],
  activities: CompetencyMatrixResponseDto["activities"],
): DeptActivityGroup[] {
  const byDept = new Map<number, CompetencyMatrixResponseDto["activities"]>();
  for (const a of activities) {
    const list = byDept.get(a.departmentId) ?? [];
    list.push(a);
    byDept.set(a.departmentId, list);
  }
  return departments
    .map((d) => ({
      department: d,
      activities: byDept.get(d.id) ?? [],
    }))
    .filter((g) => g.activities.length > 0);
}

interface EditorMeta {
  empId: string;
  activityId: number;
  workerLabel: string;
  activityLabel: string;
  competencyId: number | null;
  level: 0 | 1;
  activeDate: string;
  expiryDate: string;
}

interface CellEditorPopoverProps {
  anchorEl: HTMLElement | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  state: EditorMeta;
  onClose: () => void;
  onAfterMutation: () => void;
}

function CellEditorPopover({
  anchorEl,
  scrollContainerRef,
  state,
  onClose,
  onAfterMutation,
}: CellEditorPopoverProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState<0 | 1>(state.level);
  const [activeDate, setActiveDate] = useState(state.activeDate);
  const [expiryDate, setExpiryDate] = useState(state.expiryDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback((): void => {
    if (!anchorEl || typeof window === "undefined") {
      return;
    }
    const r = anchorEl.getBoundingClientRect();
    const pad = 6;
    const panelW = 288;
    const panelH = 300;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const vCenteredTop = r.top + (r.height - panelH) / 2;
    const belowTop = r.bottom + pad;
    const clampTop = (t: number): number =>
      Math.min(Math.max(pad, t), vh - panelH - pad);
    const clampLeft = (l: number): number =>
      Math.min(Math.max(pad, l), vw - panelW - pad);

    const fits = (left: number, top: number): boolean =>
      left >= pad &&
      left + panelW <= vw - pad &&
      top >= pad &&
      top + panelH <= vh - pad;

    const rightL = r.right + pad;
    const leftL = r.left - panelW - pad;

    if (fits(rightL, vCenteredTop)) {
      setPos({ top: clampTop(vCenteredTop), left: rightL });
      return;
    }
    if (fits(leftL, vCenteredTop)) {
      setPos({ top: clampTop(vCenteredTop), left: leftL });
      return;
    }
    if (fits(r.left, belowTop)) {
      setPos({ top: belowTop, left: clampLeft(r.left) });
      return;
    }
    // Last resort: below anchor, full clamp
    setPos({
      top: clampTop(belowTop),
      left: clampLeft(r.left),
    });
  }, [anchorEl]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, state.empId, state.activityId]);

  useEffect(() => {
    setLevel(state.level);
    setActiveDate(state.activeDate);
    setExpiryDate(state.expiryDate);
    setError(null);
  }, [state]);

  useEffect(() => {
    if (!anchorEl) {
      return;
    }
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const onScrollOrResize = (): void => {
      updatePosition();
    };
    window.addEventListener("scroll", onScrollOrResize, opts);
    window.addEventListener("resize", onScrollOrResize);
    const scrollEl = scrollContainerRef.current;
    scrollEl?.addEventListener("scroll", onScrollOrResize, {
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, opts);
      window.removeEventListener("resize", onScrollOrResize);
      scrollEl?.removeEventListener("scroll", onScrollOrResize);
    };
  }, [anchorEl, scrollContainerRef, updatePosition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let onPointer: ((e: MouseEvent) => void) | null = null;
    const t = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      onPointer = (e: MouseEvent): void => {
        const el = panelRef.current;
        if (el && !el.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener("mousedown", onPointer);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (onPointer) {
        document.removeEventListener("mousedown", onPointer);
      }
    };
  }, [onClose]);

  if (!anchorEl) {
    return null;
  }

  const onSave = async (): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/competencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emp_id: state.empId,
          activity_id: state.activityId,
          level,
          active_date: activeDate,
          expiry_date: expiryDate.trim() === "" ? null : expiryDate,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      onAfterMutation();
      onClose();
    } catch {
      setError("Save failed");
    } finally {
      setPending(false);
    }
  };

  const onRemove = async (): Promise<void> => {
    if (state.competencyId === null) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/competencies/${state.competencyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Remove failed");
        return;
      }
      onAfterMutation();
      onClose();
    } catch {
      setError("Remove failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-[100] w-72 rounded-input border border-border bg-surface p-4 shadow-card"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label="Edit competency"
    >
      <p className="text-xs font-medium text-text-secondary">
        {state.workerLabel}
      </p>
      <p className="text-sm font-semibold text-text-primary">
        {state.activityLabel}
      </p>
      <div className="mt-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Level
        </p>
        <div className="inline-flex rounded-input bg-appbg p-[3px]">
          <button
            type="button"
            className={`rounded-[6px] px-3 py-1.5 text-sm font-medium ${
              level === 0
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => {
              setLevel(0);
            }}
          >
            Not qualified
          </button>
          <button
            type="button"
            className={`rounded-[6px] px-3 py-1.5 text-sm font-medium ${
              level === 1
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => {
              setLevel(1);
            }}
          >
            Qualified
          </button>
        </div>
      </div>
      <label className="mt-3 block text-xs font-medium text-text-secondary">
        Active date
        <input
          type="date"
          className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary"
          value={activeDate}
          onChange={(e) => {
            setActiveDate(e.target.value);
          }}
        />
      </label>
      <label className="mt-2 block text-xs font-medium text-text-secondary">
        Expiry date (optional)
        <input
          type="date"
          className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary"
          value={expiryDate}
          onChange={(e) => {
            setExpiryDate(e.target.value);
          }}
        />
      </label>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light active:scale-[0.97] disabled:opacity-50"
          onClick={() => {
            void onSave();
          }}
        >
          Save
        </button>
        <button
          type="button"
          disabled={pending || state.competencyId === null}
          className="rounded-input border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-appbg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            void onRemove();
          }}
        >
          Remove
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-input border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-appbg active:scale-[0.97]"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Legend(): JSX.Element {
  const items: { visual: CellVisual; label: string }[] = [
    { visual: "empty", label: "Unknown" },
    { visual: "notQualified", label: "Not qualified" },
    { visual: "qualified", label: "Qualified" },
    { visual: "expired", label: "Expired" },
    { visual: "expiring", label: "Expiring (30d)" },
  ];
  return (
    <ul className="flex flex-col gap-1.5 text-left text-xs text-text-secondary sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
      {items.map(({ visual, label }) => (
        <li key={visual} className="flex items-center gap-2">
          <span className={legendCellClass(visual)}>{cellSymbol(visual)}</span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

function skeletonDeptIndexForColumn(colIdx: number): number {
  let start = 0;
  for (let i = 0; i < SKELETON_DEPT_COL_SPANS.length; i++) {
    const span = SKELETON_DEPT_COL_SPANS[i]!;
    if (colIdx < start + span) {
      return i;
    }
    start += span;
  }
  return Math.max(0, SKELETON_DEPT_COL_SPANS.length - 1);
}

function CompetencyMatrixTableSkeleton(): JSX.Element {
  const nameColStyle = {
    width: EMPLOYEE_NAME_COL_WIDTH,
    minWidth: EMPLOYEE_NAME_COL_WIDTH,
    maxWidth: EMPLOYEE_NAME_COL_WIDTH,
  } as const;

  return (
    <table
      className="table-fixed w-max border-collapse text-[13px]"
      aria-hidden
    >
      <colgroup>
        <col className="min-w-0" style={nameColStyle} />
        {Array.from({ length: SKELETON_MATRIX_ACTIVITY_COLS }, (_, i) => (
          <col
            key={i}
            style={{
              width: ACTIVITY_COL_WIDTH_PX,
              minWidth: ACTIVITY_COL_WIDTH_PX,
            }}
          />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-border/80">
          <th
            rowSpan={2}
            scope="col"
            style={nameColStyle}
            className="sticky left-0 z-[120] border-b border-r border-border/60 bg-surface py-2 pl-5 pr-2 text-left align-top shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] backface-hidden transform-gpu"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-9 w-full rounded-input" />
          </th>
          {SKELETON_DEPT_COL_SPANS.map((span, gi) => (
            <th
              key={gi}
              scope="colgroup"
              colSpan={span}
              className={`border-b border-border/60 bg-appbg/90 px-1 py-2 ${
                gi > 0 ? "border-l-2 border-l-primary/25" : ""
              }`}
            >
              <Skeleton className="mx-auto h-3 w-28 max-w-full" />
            </th>
          ))}
        </tr>
        <tr className="border-b border-border">
          {Array.from({ length: SKELETON_MATRIX_ACTIVITY_COLS }, (_, idx) => {
            const prevDept =
              idx > 0 ? skeletonDeptIndexForColumn(idx - 1) : null;
            const currDept = skeletonDeptIndexForColumn(idx);
            const deptBoundary =
              prevDept !== null && currDept !== prevDept;
            const activityLeftBorder = deptBoundary
              ? "border-l-2 border-l-primary/30"
              : "border-l border-border/70";
            return (
              <th
                key={idx}
                scope="col"
                className={`min-h-[2.5rem] min-w-0 border-b border-border/60 bg-appbg/50 px-1 py-1.5 ${activityLeftBorder}`}
              >
                <Skeleton
                  className={`mx-auto min-h-[2rem] ${
                    idx % 4 === 0 ? "w-14" : idx % 4 === 1 ? "w-10" : "w-12"
                  }`}
                />
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: SKELETON_MATRIX_ROWS }, (_, ri) => (
          <tr key={ri} className="border-b border-border/50">
            <th
              scope="row"
              style={nameColStyle}
              className="sticky left-0 z-[110] border-r border-border/60 bg-surface py-1.5 pl-5 pr-2 text-left align-middle font-normal shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] backface-hidden transform-gpu"
            >
              <Skeleton className="h-4 w-[88%]" />
              <Skeleton className="mt-1.5 h-3 w-[55%]" />
            </th>
            {Array.from({ length: SKELETON_MATRIX_ACTIVITY_COLS }, (_, ci) => (
              <td
                key={ci}
                className="border-l border-border/40 bg-surface p-0 align-middle"
              >
                <div className="flex h-10 items-center justify-center px-0.5">
                  <Skeleton className="h-6 w-7 rounded-input" />
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CompetencyMatrixPage(): JSX.Element {
  const tableCaptionId = useId();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof ROW_LIMITS)[number]>(20);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [selectedShiftIds, setSelectedShiftIds] = useState<number[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<
    CompetencyStatusToken[]
  >([]);
  const [qInput, setQInput] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  const [matrix, setMatrix] = useState<CompetencyMatrixResponseDto | null>(
    null,
  );
  const [kpis, setKpis] = useState<CompetencyKpisResponseDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shiftOptions, setShiftOptions] = useState<
    { id: number; label: string }[]
  >([]);

  const [editor, setEditor] = useState<{
    meta: EditorMeta;
    anchorEl: HTMLElement;
  } | null>(null);

  const matrixScrollRef = useRef<HTMLDivElement>(null);

  const dateCtx = useMemo(() => getCompetencyDateContext(), []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQDebounced(qInput.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [selectedDeptIds, selectedShiftIds, selectedActivityIds, selectedStatuses]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const res = await fetch("/api/shifts");
        if (!res.ok || cancelled) {
          return;
        }
        const json = (await res.json()) as {
          shifts: { id: number; name: string }[];
        };
        if (cancelled) {
          return;
        }
        setShiftOptions(
          json.shifts.map((s) => ({ id: s.id, label: s.name })),
        );
      } catch {
        // Keep empty options on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchKpis = useCallback(async (): Promise<void> => {
    const res = await fetch("/api/competencies/kpis");
    if (!res.ok) {
      throw new Error("Failed to load KPIs");
    }
    setKpis((await res.json()) as CompetencyKpisResponseDto);
  }, []);

  const fetchMatrix = useCallback(async (): Promise<void> => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    if (selectedDeptIds.length > 0) {
      sp.set("depts", selectedDeptIds.join(","));
    }
    if (selectedShiftIds.length > 0) {
      sp.set("shifts", selectedShiftIds.join(","));
    }
    if (selectedStatuses.length > 0) {
      sp.set("statuses", selectedStatuses.join(","));
    }
    if (qDebounced) {
      sp.set("q", qDebounced);
    }
    const res = await fetch(`/api/competencies/matrix?${sp.toString()}`);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      throw new Error(j.error ?? "Failed to load matrix");
    }
    setMatrix((await res.json()) as CompetencyMatrixResponseDto);
  }, [
    page,
    limit,
    selectedDeptIds,
    selectedShiftIds,
    selectedStatuses,
    qDebounced,
  ]);

  const refresh = useCallback(async (): Promise<void> => {
    setLoadError(null);
    setLoading(true);
    try {
      await Promise.all([fetchKpis(), fetchMatrix()]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [fetchKpis, fetchMatrix]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const competencyMap = useMemo(() => {
    const m = new Map<string, CompetencyMatrixCellDto>();
    if (!matrix) {
      return m;
    }
    for (const c of matrix.competencies) {
      m.set(`${c.employeeId}:${c.activityId}`, c);
    }
    return m;
  }, [matrix]);

  /** All activities (for filter dropdown and column ordering). */
  const allActivityGroups = useMemo(() => {
    if (!matrix) {
      return [];
    }
    return buildActivityGroups(matrix.departments, matrix.activities);
  }, [matrix]);

  /** Columns: subset when Activities filter is set (does not filter employee rows). */
  const columnActivityGroups = useMemo(() => {
    if (!matrix) {
      return [];
    }
    const baseGroups = buildActivityGroups(
      matrix.departments,
      matrix.activities,
    );
    if (selectedActivityIds.length === 0) {
      return baseGroups;
    }
    const idSet = new Set(selectedActivityIds);
    const ordered = baseGroups
      .flatMap((g) => g.activities)
      .filter((a) => idSet.has(a.id));
    return buildActivityGroups(matrix.departments, ordered);
  }, [matrix, selectedActivityIds]);

  const flatActivities = useMemo(
    () => columnActivityGroups.flatMap((g) => g.activities),
    [columnActivityGroups],
  );

  const deptOptions = useMemo(
    () =>
      (matrix?.departments ?? []).map((d) => ({
        id: d.id,
        label: d.name,
      })),
    [matrix?.departments],
  );

  const activityOptions = useMemo(
    () =>
      allActivityGroups.flatMap((g) =>
        g.activities.map((a) => ({
          id: a.id,
          label: a.name,
        })),
      ),
    [allActivityGroups],
  );

  const totalPages =
    matrix && matrix.limit > 0
      ? Math.max(1, Math.ceil(matrix.totalWorkers / matrix.limit))
      : 1;

  const hasNonDefaultFilters =
    selectedDeptIds.length > 0 ||
    selectedShiftIds.length > 0 ||
    selectedActivityIds.length > 0 ||
    selectedStatuses.length > 0 ||
    qInput.trim().length > 0;

  const onClearFilters = useCallback((): void => {
    setSelectedDeptIds([]);
    setSelectedShiftIds([]);
    setSelectedActivityIds([]);
    setSelectedStatuses([]);
    setQInput("");
    setPage(1);
  }, []);

  function openCellEditor(
    el: HTMLElement,
    w: CompetencyMatrixWorkerDto,
    a: CompetencyMatrixActivityDto,
    cell: CompetencyMatrixCellDto | undefined,
  ): void {
    const today = new Date();
    const y = today.toISOString().slice(0, 10);
    setEditor({
      anchorEl: el,
      meta: {
        empId: w.empId,
        activityId: a.id,
        workerLabel: `${w.lastName}, ${w.firstName}`,
        activityLabel: a.name,
        competencyId: cell?.competencyId ?? null,
        level:
          cell?.level === 1 || cell?.level === 2 ? 1 : 0,
        activeDate: cell?.activeDate ?? y,
        expiryDate: cell?.expiryDate ?? "",
      },
    });
  }

  const activityColCount = flatActivities.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <header className="min-w-0 flex-1 lg:max-w-[50%]">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            Competency Matrix
          </p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-text-primary">
            Qualifications
          </h1>
        </header>
        <div className="w-full lg:ml-auto lg:max-w-[50%]">
          <div className="rounded-card border border-border bg-surface p-3 shadow-card">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2 lg:justify-end">
              <div className="min-w-[140px] max-w-[200px]">
                <SearchableMultiSelect
                  label="Departments"
                  options={deptOptions}
                  selectedIds={selectedDeptIds}
                  onChange={setSelectedDeptIds}
                />
              </div>
              <div className="min-w-[140px] max-w-[200px]">
                <SearchableMultiSelect
                  label="Shifts"
                  options={shiftOptions}
                  selectedIds={selectedShiftIds}
                  onChange={setSelectedShiftIds}
                />
              </div>
              <div className="min-w-[140px] max-w-[200px]">
                <SearchableMultiSelect
                  label="Activities"
                  options={activityOptions}
                  selectedIds={selectedActivityIds}
                  onChange={setSelectedActivityIds}
                />
              </div>
              <div className="min-w-[140px] max-w-[200px]">
                <CompetencyStatusMultiSelect
                  selected={selectedStatuses}
                  onChange={setSelectedStatuses}
                />
              </div>
              <button
                type="button"
                disabled={!hasNonDefaultFilters}
                className="mb-0.5 rounded-input border border-border bg-appbg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onClearFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {kpis ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricStatCard
            label="Activities with < 3 qualified employees"
            value={String(kpis.lowCoverageActivities)}
            borderAccent={
              kpis.lowCoverageActivities > 0 ? "accent" : "primary"
            }
          />
          <MetricStatCard
            label="Employees with < 3 qualified activities"
            value={String(kpis.lowSkillWorkers)}
            borderAccent="primary"
          />
          <MetricStatCard
            label="Expired competencies"
            value={String(kpis.expired)}
            borderAccent={kpis.expired > 0 ? "danger" : "primary"}
          />
          <MetricStatCard
            label="Expiring in 30 days"
            value={String(kpis.expiringSoon)}
            borderAccent={kpis.expiringSoon > 0 ? "accent" : "primary"}
          />
        </div>
      ) : null}

      {loadError ? (
        <p className="text-sm text-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      <section className="rounded-card border border-border bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            Competency Matrix
          </h2>
          <Legend />
        </div>

        <div
          ref={matrixScrollRef}
          className="relative isolate z-0 overflow-x-auto py-4 pl-0 pr-4"
        >
          {loading && !matrix ? (
            <>
              <span className="sr-only">Loading competency matrix</span>
              <CompetencyMatrixTableSkeleton />
            </>
          ) : null}
          {matrix ? (
            <table
              className="table-fixed w-max border-collapse text-[13px]"
              aria-describedby={tableCaptionId}
            >
              <caption id={tableCaptionId} className="sr-only">
                Competency matrix: Employees in rows, Activities in columns.
              </caption>
              <colgroup>
                <col
                  className="min-w-0"
                  style={{
                    width: EMPLOYEE_NAME_COL_WIDTH,
                    minWidth: EMPLOYEE_NAME_COL_WIDTH,
                    maxWidth: EMPLOYEE_NAME_COL_WIDTH,
                  }}
                />
                {activityColCount > 0
                  ? flatActivities.map((a) => (
                      <col
                        key={a.id}
                        style={{ width: ACTIVITY_COL_WIDTH_PX, minWidth: ACTIVITY_COL_WIDTH_PX }}
                      />
                    ))
                  : null}
              </colgroup>
              <thead>
                <tr className="border-b border-border/80">
                  <th
                    rowSpan={2}
                    scope="col"
                    style={{
                      width: EMPLOYEE_NAME_COL_WIDTH,
                      minWidth: EMPLOYEE_NAME_COL_WIDTH,
                      maxWidth: EMPLOYEE_NAME_COL_WIDTH,
                    }}
                    className="sticky left-0 z-[120] border-b border-r border-border/60 bg-surface py-2 pl-5 pr-2 text-left align-top shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] backface-hidden transform-gpu"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      Employee Name
                    </span>
                    <input
                      type="search"
                      className="mt-2 w-full rounded-input border border-border bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                      placeholder="Search"
                      value={qInput}
                      onChange={(e) => {
                        setQInput(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </th>
                  {columnActivityGroups.map((g, gi) => (
                    <th
                      key={g.department.id}
                      scope="colgroup"
                      colSpan={g.activities.length}
                      className={`border-b border-border/60 bg-appbg/90 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-text-secondary ${
                        gi > 0 ? "border-l-2 border-l-primary/25" : ""
                      }`}
                    >
                      {g.department.name} ({g.activities.length})
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  {flatActivities.map((a, idx) => {
                    const prev =
                      idx > 0 ? flatActivities[idx - 1] : undefined;
                    const deptBoundary =
                      prev !== undefined &&
                      prev.departmentId !== a.departmentId;
                    const activityLeftBorder = deptBoundary
                      ? "border-l-2 border-l-primary/30"
                      : "border-l border-border/70";
                    return (
                    <th
                      key={a.id}
                      scope="col"
                      title={a.name}
                      className={`min-h-[2.5rem] min-w-0 break-words border-b border-border/60 bg-appbg/50 px-1 py-1.5 text-center text-[11px] font-medium leading-tight text-text-secondary whitespace-normal ${activityLeftBorder}`}
                    >
                      {a.name}
                    </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {matrix.workers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, activityColCount + 1)}
                      className="bg-surface px-3 py-6 text-center text-sm text-text-secondary"
                    >
                      No Employees match the current filters. Adjust search or
                      filters above.
                    </td>
                  </tr>
                ) : null}
                {matrix.workers.map((w) => {
                  const workerName = `${w.lastName}, ${w.firstName}`;
                  return (
                  <tr
                    key={w.empId}
                    className="group/matrix-row border-b border-border/50"
                  >
                    <th
                      scope="row"
                      title={workerName}
                      style={{
                        width: EMPLOYEE_NAME_COL_WIDTH,
                        minWidth: EMPLOYEE_NAME_COL_WIDTH,
                        maxWidth: EMPLOYEE_NAME_COL_WIDTH,
                      }}
                      className="sticky left-0 z-[110] border-r border-border/60 bg-surface py-1.5 pl-5 pr-2 text-left align-middle font-normal shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-black/0 before:transition-colors group-hover/matrix-row:before:bg-black/[0.022] hover:before:bg-black/[0.055] backface-hidden transform-gpu"
                    >
                      <span className="relative z-10 block truncate font-medium text-text-primary" title={workerName}>
                        {workerName}
                      </span>
                      <span className="relative z-10 mt-0.5 block truncate text-[11px] text-text-secondary" title={w.departmentName}>
                        {w.departmentName}
                      </span>
                    </th>
                    {flatActivities.map((a) => {
                      const cell = competencyMap.get(`${w.empId}:${a.id}`);
                      const visual = getCellVisual(cell, dateCtx);
                      const sym = cellSymbol(visual);
                      const selected =
                        editor?.meta.empId === w.empId &&
                        editor?.meta.activityId === a.id;
                      const label = `Competency ${w.firstName} ${w.lastName}, ${a.name}: ${visual}`;
                      const tone = matrixCellTone(visual);
                      return (
                        <td
                          key={a.id}
                          role="gridcell"
                          tabIndex={0}
                          aria-label={label}
                          className={[
                            "relative z-0 cursor-pointer border-l border-border/40 p-0 align-middle outline-none transition-[color,box-shadow] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-black/0 before:transition-colors group-hover/matrix-row:before:bg-black/[0.022] hover:before:bg-black/[0.065] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0",
                            selected
                              ? "ring-2 ring-inset ring-accent"
                              : "",
                            tone,
                          ].join(" ")}
                          onClick={(e) => {
                            openCellEditor(e.currentTarget, w, a, cell);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openCellEditor(e.currentTarget, w, a, cell);
                            }
                          }}
                        >
                          <div className="relative z-10 flex h-10 items-center justify-center text-sm font-medium">
                            {sym}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>

        {matrix ? (
          <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-text-secondary">
              {matrix.totalWorkers}{" "}
              {matrix.totalWorkers === 1 ? "Employee" : "Employees"}
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                Rows per page
                <select
                  value={limit}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setLimit(
                      ROW_LIMITS.includes(n as (typeof ROW_LIMITS)[number])
                        ? (n as (typeof ROW_LIMITS)[number])
                        : 20,
                    );
                    setPage(1);
                  }}
                  className="rounded-input border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
                >
                  {ROW_LIMITS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {totalPages > 1 ? (
                <nav
                  className="flex flex-wrap items-center gap-2 text-sm"
                  aria-label="Pagination"
                >
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setPage(1);
                    }}
                    className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
                  >
                    First
                  </button>
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-text-secondary">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => {
                      setPage((p) => p + 1);
                    }}
                    className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => {
                      setPage(totalPages);
                    }}
                    className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
                  >
                    Last
                  </button>
                </nav>
              ) : (
                <span className="text-sm text-text-secondary">
                  Page {page} of {totalPages}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {editor ? (
        <CellEditorPopover
          anchorEl={editor.anchorEl}
          scrollContainerRef={matrixScrollRef}
          state={editor.meta}
          onClose={() => {
            setEditor(null);
          }}
          onAfterMutation={() => {
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
