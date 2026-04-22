"use client";

import type { JSX, MouseEvent, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Skeleton } from "@/components/ui/skeleton";

import type {
  ProjectsTimelineResponse,
  SubProjectStatusDto,
  TimelineMilestoneDto,
  TimelineProjectDto,
  TimelineSubProjectDto,
} from "@/lib/api-dtos";
import {
  getProjectColor,
  pickNextProjectColorKey,
  PROJECT_COLOR_KEYS,
  PROJECT_COLORS,
} from "@/lib/constants";
import {
  barLayoutForRange,
  percentForDateInRange,
  plannedHoursFromYmd,
} from "@/lib/timeline-geometry";
import {
  addUtcDays,
  addUtcMonths,
  columnLabels,
  formatFriendlyDayMonthUtc,
  formatInclusiveRangeLabel,
  formatYmd,
  getTimelineRange,
  offsetMonthsForTimelineRangeStart,
  offsetWeeksForTimelineRangeStart,
  parseYmdToUtcMidnight,
  startOfUtcDay,
  startOfUtcMonth,
  type TimelineViewMode,
} from "@/lib/timeline-range";

type Row =
  | { kind: "project"; project: TimelineProjectDto }
  | { kind: "sub"; project: TimelineProjectDto; sub: TimelineSubProjectDto };

function filterProjects(
  projects: TimelineProjectDto[],
  q: string,
): TimelineProjectDto[] {
  const t = q.trim().toLowerCase();
  if (!t) {
    return projects;
  }
  return projects
    .map((p) => {
      const hitP =
        p.name.toLowerCase().includes(t) ||
        p.projectCode.toLowerCase().includes(t);
      const subs = hitP
        ? p.subProjects
        : p.subProjects.filter((s) => s.name.toLowerCase().includes(t));
      if (subs.length === 0) {
        return null;
      }
      return { ...p, subProjects: subs };
    })
    .filter((p): p is TimelineProjectDto => p != null);
}

function parentSpan(
  subs: TimelineSubProjectDto[],
): { start: string | null; end: string | null } {
  const starts = subs
    .map((s) => s.plannedStart)
    .filter((x): x is string => x != null);
  const ends = subs
    .map((s) => s.plannedEnd)
    .filter((x): x is string => x != null);
  if (starts.length === 0 || ends.length === 0) {
    return { start: null, end: null };
  }
  return {
    start: starts.sort()[0]!,
    end: ends.sort()[ends.length - 1]!,
  };
}

type AlertKind = "overdue" | "slipped" | "no_dates" | "on_track" | "neutral";

function rowAlert(
  sub: TimelineSubProjectDto,
  todayYmd: string,
): AlertKind {
  if (!sub.plannedStart || !sub.plannedEnd) {
    return "no_dates";
  }
  if (sub.status !== "completed" && sub.plannedEnd < todayYmd) {
    return "overdue";
  }
  if (
    sub.baselineEnd &&
    sub.plannedEnd &&
    sub.plannedEnd > sub.baselineEnd
  ) {
    return "slipped";
  }
  if (sub.status === "in_progress" && sub.plannedEnd >= todayYmd) {
    return "on_track";
  }
  return "neutral";
}

const ALERT_ORDER: AlertKind[] = [
  "overdue",
  "slipped",
  "no_dates",
  "on_track",
  "neutral",
];

function projectAlert(
  subs: TimelineSubProjectDto[],
  todayYmd: string,
): AlertKind {
  if (subs.length === 0) {
    return "neutral";
  }
  let best: AlertKind = "neutral";
  for (const s of subs) {
    const a = rowAlert(s, todayYmd);
    if (ALERT_ORDER.indexOf(a) < ALERT_ORDER.indexOf(best)) {
      best = a;
    }
  }
  return best;
}

function projectAlertLabel(kind: AlertKind): string {
  switch (kind) {
    case "overdue":
      return "Overdue";
    case "slipped":
      return "Slipped";
    case "no_dates":
      return "Not planned";
    case "on_track":
      return "On track";
    case "neutral":
    default:
      return "—";
  }
}

function subStatusLabel(status: SubProjectStatusDto): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "on_hold":
      return "On hold";
    default:
      return status;
  }
}

function displaySubProjectName(
  projectName: string,
  subFullName: string,
): string {
  const prefix = `${projectName} — `;
  if (subFullName.startsWith(prefix)) {
    return subFullName.slice(prefix.length);
  }
  return subFullName;
}

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

/** Project / timeline row tint using palette hex (visible on white surface). */
const PROJECT_ROW_TINT_ALPHA = 0.14;

function pickerEndYmdFromStart(
  startYmd: string,
  mode: TimelineViewMode,
): string {
  const d = parseYmdToUtcMidnight(startYmd);
  if (mode === "week") {
    return formatYmd(addUtcDays(d, 13 * 7 - 1));
  }
  const m = startOfUtcMonth(d);
  return formatYmd(addUtcDays(addUtcMonths(m, 6), -1));
}

/** Two calendar months inclusive: e.g. Jun 1 → Jul 31. */
function twoMonthSpanYmdsFromMonthStart(monthStart: Date): {
  startYmd: string;
  endYmd: string;
} {
  const start = startOfUtcMonth(monthStart);
  const endInclusive = addUtcDays(addUtcMonths(start, 2), -1);
  return { startYmd: formatYmd(start), endYmd: formatYmd(endInclusive) };
}

function columnMonthStartForSpan(
  mode: TimelineViewMode,
  timelineRangeStart: Date,
  colIndex: number,
): Date {
  if (mode === "month") {
    return addUtcMonths(timelineRangeStart, colIndex);
  }
  const weekStart = addUtcDays(timelineRangeStart, colIndex * 7);
  return startOfUtcMonth(weekStart);
}

function subStatusBarClass(status: SubProjectStatusDto): string {
  switch (status) {
    case "not_started":
      return "border border-text-secondary/35 bg-text-secondary/12";
    case "in_progress":
      return "border border-primary/45 bg-primary/22";
    case "completed":
      return "border border-success/45 bg-success/22";
    case "on_hold":
      return "border border-accent/40 bg-accent/18";
    default:
      return "border border-text-secondary/35 bg-text-secondary/12";
  }
}

function TimelineTooltip({
  tip,
  children,
}: {
  tip: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const onMove = (e: MouseEvent<HTMLSpanElement>): void => {
    setCoords({ x: e.clientX, y: e.clientY });
  };

  return (
    <span
      className="contents"
      onMouseEnter={(e) => {
        setOpen(true);
        setCoords({ x: e.clientX, y: e.clientY });
      }}
      onMouseMove={onMove}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[9999] max-w-[280px] rounded-md border border-border bg-white px-3 py-2 text-left text-xs leading-snug text-text-primary shadow-card"
              style={{
                left: coords.x + 14,
                top: coords.y + 14,
              }}
              role="tooltip"
            >
              {tip}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

function milestoneDisplayStatus(
  m: TimelineMilestoneDto,
  todayYmd: string,
): "pending" | "achieved" | "missed" {
  if (m.status !== "pending") {
    return m.status;
  }
  return m.targetDate < todayYmd ? "missed" : "pending";
}

function milestoneColor(
  m: TimelineMilestoneDto,
  todayYmd: string,
): string {
  const s = milestoneDisplayStatus(m, todayYmd);
  if (s === "missed") {
    return "#C0392B";
  }
  if (s === "achieved") {
    return "#1A6B45";
  }
  return "#E8A020";
}

function milestoneStatusTip(
  m: TimelineMilestoneDto,
  todayYmd: string,
): string {
  const s = milestoneDisplayStatus(m, todayYmd);
  if (s === "achieved") {
    return "Achieved";
  }
  if (s === "missed") {
    return "Missed";
  }
  return "Pending";
}

interface SubProjectEditModalProps {
  sub: TimelineSubProjectDto;
  siblings: TimelineSubProjectDto[];
  initialPlannedStart?: string;
  initialPlannedEnd?: string;
  onClose: () => void;
  onSaved: () => void;
}

function SubProjectEditModal({
  sub,
  siblings,
  initialPlannedStart,
  initialPlannedEnd,
  onClose,
  onSaved,
}: SubProjectEditModalProps): JSX.Element {
  const [status, setStatus] = useState<SubProjectStatusDto>(sub.status);
  const [plannedStart, setPlannedStart] = useState(
    () => initialPlannedStart ?? sub.plannedStart ?? "",
  );
  const [plannedEnd, setPlannedEnd] = useState(
    () => initialPlannedEnd ?? sub.plannedEnd ?? "",
  );
  const [pred, setPred] = useState<string>(
    sub.predecessorSubProjectId != null
      ? String(sub.predecessorSubProjectId)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setPlannedStart(initialPlannedStart ?? sub.plannedStart ?? "");
    setPlannedEnd(initialPlannedEnd ?? sub.plannedEnd ?? "");
  }, [
    sub.id,
    sub.plannedStart,
    sub.plannedEnd,
    initialPlannedStart,
    initialPlannedEnd,
  ]);

  const submit = async (): Promise<void> => {
    setSaving(true);
    setErr(null);
    const body: Record<string, unknown> = {
      status,
      plannedStart: plannedStart || null,
      plannedEnd: plannedEnd || null,
      predecessorSubProjectId: pred === "" ? null : Number(pred),
    };
    const res = await fetch(`/api/sub-projects/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setErr(j.error ?? "Save failed");
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-edit-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,420px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-6 shadow-card"
      >
        <h2
          id="sub-edit-title"
          className="text-base font-semibold text-text-primary"
        >
          Edit sub-project
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{sub.name}</p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-text-secondary">
            Status
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as SubProjectStatusDto)
              }
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On hold</option>
            </select>
          </label>
          <label className="block text-sm text-text-secondary">
            Planned start
            <input
              type="date"
              value={plannedStart}
              onChange={(e) => setPlannedStart(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Planned end
            <input
              type="date"
              value={plannedEnd}
              onChange={(e) => setPlannedEnd(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Predecessor (finish-to-start)
            <select
              value={pred}
              onChange={(e) => setPred(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {siblings
                .filter((s) => s.id !== sub.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {err ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-border px-4 py-2 text-sm font-medium text-text-primary transition-transform active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

interface MilestoneModalProps {
  mode: "create" | "edit";
  milestoneId?: number;
  projects?: TimelineProjectDto[];
  initial?: Partial<{
    name: string;
    targetDate: string;
    status: TimelineMilestoneDto["status"];
    projectId: number | null;
    subProjectId: number | null;
  }>;
  onClose: () => void;
  onSaved: () => void;
}

function MilestoneModal({
  mode,
  milestoneId,
  projects,
  initial,
  onClose,
  onSaved,
}: MilestoneModalProps): JSX.Element {
  const firstProjectId = projects?.[0]?.id ?? 0;
  const [name, setName] = useState(initial?.name ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [status, setStatus] = useState<TimelineMilestoneDto["status"]>(
    initial?.status ?? "pending",
  );
  const [selProjectId, setSelProjectId] = useState<number>(
    initial?.projectId ?? firstProjectId,
  );
  const [selSubScope, setSelSubScope] = useState<number | "project">(
    initial?.subProjectId != null ? initial.subProjectId : "project",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const useProjectPickers =
    mode === "create" && projects != null && projects.length > 0;

  const selectedProject = useMemo(
    () => projects?.find((p) => p.id === selProjectId),
    [projects, selProjectId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (): Promise<void> => {
    setSaving(true);
    setErr(null);
    if (mode === "create") {
      let projectId: number | null = null;
      let subProjectId: number | null = null;
      if (useProjectPickers) {
        if (!selProjectId) {
          setSaving(false);
          setErr("Select a project");
          return;
        }
        const p = projects!.find((x) => x.id === selProjectId);
        if (!p) {
          setSaving(false);
          setErr("Invalid project");
          return;
        }
        if (selSubScope === "project") {
          projectId = selProjectId;
        } else {
          const sub = p.subProjects.find((s) => s.id === selSubScope);
          if (!sub) {
            setSaving(false);
            setErr("Sub-project does not belong to the selected project");
            return;
          }
          subProjectId = selSubScope;
        }
      } else {
        projectId = initial?.projectId ?? null;
        subProjectId = initial?.subProjectId ?? null;
      }
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetDate,
          status,
          projectId,
          subProjectId,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Save failed");
        return;
      }
    } else if (milestoneId != null) {
      const res = await fetch(`/api/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetDate, status }),
      });
      setSaving(false);
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Save failed");
        return;
      }
    }
    onSaved();
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ms-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,440px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-6 shadow-card"
      >
        <h2 id="ms-title" className="text-base font-semibold text-text-primary">
          {mode === "create" ? "New Milestone" : "Edit Milestone"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-text-secondary">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
          {useProjectPickers ? (
            <>
              <label className="block text-sm text-text-secondary">
                Project
                <select
                  value={String(selProjectId)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSelProjectId(v);
                    setSelSubScope("project");
                  }}
                  className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary"
                >
                  {projects!.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-text-secondary">
                Sub-project
                <select
                  value={
                    selSubScope === "project" ? "" : String(selSubScope)
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelSubScope(v === "" ? "project" : Number(v));
                  }}
                  className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary"
                >
                  <option value="">Select Department</option>
                  {selectedProject?.subProjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {displaySubProjectName(selectedProject.name, s.name)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="block text-sm text-text-secondary">
            Target date
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Status
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as TimelineMilestoneDto["status"])
              }
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="achieved">Achieved</option>
              <option value="missed">Missed</option>
            </select>
          </label>
        </div>
        {err ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-border px-4 py-2 text-sm font-medium active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim() || !targetDate}
            onClick={() => void submit()}
            className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

function ProjectColorSwatchRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <span className="block text-sm text-text-secondary">Color</span>
      <div className="flex flex-wrap gap-2">
        {PROJECT_COLOR_KEYS.map((key) => {
          const meta = PROJECT_COLORS[key];
          if (!meta) {
            return null;
          }
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              title={meta.name}
              aria-label={`${meta.name}${selected ? ", selected" : ""}`}
              aria-pressed={selected}
              className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-transform active:scale-95 ${
                selected
                  ? "border-text-primary ring-2 ring-text-primary/30"
                  : "border-white/70 shadow-sm ring-1 ring-black/10"
              }`}
              style={{ backgroundColor: meta.hex }}
              onClick={() => onChange(key)}
            >
              {selected ? (
                <span className="pointer-events-none text-[10px] font-bold leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface EditProjectModalProps {
  project: TimelineProjectDto;
  onClose: () => void;
  onSaved: () => void;
}

function EditProjectModal({
  project,
  onClose,
  onSaved,
}: EditProjectModalProps): JSX.Element {
  const [name, setName] = useState(project.name);
  const [colorKey, setColorKey] = useState(project.colorKey);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setName(project.name);
    setColorKey(project.colorKey);
  }, [project.id, project.name, project.colorKey]);

  const submit = async (): Promise<void> => {
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        colorKey,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setErr(j.error ?? "Save failed");
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,420px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-6 shadow-card"
      >
        <h2 id="ep-title" className="text-base font-semibold text-text-primary">
          Edit Project
        </h2>
        <p className="mt-1 font-mono text-xs text-text-secondary">
          {project.projectCode}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-text-secondary">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <ProjectColorSwatchRow value={colorKey} onChange={setColorKey} />
        </div>
        {err ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-border px-4 py-2 text-sm active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void submit()}
            className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

interface NewProjectModalProps {
  usedColorKeys: string[];
  onClose: () => void;
  onCreated: () => void;
}

function NewProjectModal({
  usedColorKeys,
  onClose,
  onCreated,
}: NewProjectModalProps): JSX.Element {
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [colorKey, setColorKey] = useState(() =>
    pickNextProjectColorKey(usedColorKeys),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (): Promise<void> => {
    setSaving(true);
    setErr(null);
    const body: Record<string, unknown> = {
      name: name.trim(),
      projectCode: projectCode.trim().toUpperCase(),
    };
    if (plannedStart) {
      body.plannedStart = plannedStart;
    }
    if (plannedEnd) {
      body.plannedEnd = plannedEnd;
    }
    body.colorKey = colorKey;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setErr(j.error ?? "Create failed");
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="np-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,420px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-6 shadow-card"
      >
        <h2 id="np-title" className="text-base font-semibold text-text-primary">
          New Project
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-text-secondary">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Project code
            <input
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 font-mono text-sm uppercase"
            />
          </label>
          <ProjectColorSwatchRow value={colorKey} onChange={setColorKey} />
          <label className="block text-sm text-text-secondary">
            Planned start (optional)
            <input
              type="date"
              value={plannedStart}
              onChange={(e) => setPlannedStart(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Planned end (optional)
            <input
              type="date"
              value={plannedEnd}
              onChange={(e) => setPlannedEnd(e.target.value)}
              className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm"
            />
          </label>
        </div>
        {err ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-border px-4 py-2 text-sm active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim() || !projectCode.trim()}
            onClick={() => void submit()}
            className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </>
  );
}

function DependencyCurves({
  rows,
  rowIndexBySubId,
  rangeStart,
  rangeEndInclusive,
}: {
  rows: Row[];
  rowIndexBySubId: Map<number, number>;
  rangeStart: Date;
  rangeEndInclusive: Date;
}): JSX.Element | null {
  const n = rows.length;
  if (n === 0) {
    return null;
  }

  const paths: JSX.Element[] = [];
  let k = 0;
  for (const row of rows) {
    if (row.kind !== "sub" || !row.sub.predecessorSubProjectId) {
      continue;
    }
    const predId = row.sub.predecessorSubProjectId;
    const succId = row.sub.id;
    const ri = rowIndexBySubId.get(predId);
    const rj = rowIndexBySubId.get(succId);
    if (ri === undefined || rj === undefined) {
      continue;
    }
    const predRow = rows[ri];
    const succRow = rows[rj];
    if (predRow?.kind !== "sub" || succRow?.kind !== "sub") {
      continue;
    }
    const predLayout = barLayoutForRange(
      predRow.sub.plannedStart,
      predRow.sub.plannedEnd,
      rangeStart,
      rangeEndInclusive,
    );
    const succLayout = barLayoutForRange(
      succRow.sub.plannedStart,
      succRow.sub.plannedEnd,
      rangeStart,
      rangeEndInclusive,
    );
    if (!predLayout || !succLayout) {
      continue;
    }
    const x1 = predLayout.leftPct + predLayout.widthPct;
    const x2 = succLayout.leftPct;
    const y1 = ((ri + 0.5) / n) * 100;
    const y2 = ((rj + 0.5) / n) * 100;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + 8;
    const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    paths.push(
      <path
        key={`${predId}-${succId}-${k++}`}
        d={d}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth={0.35}
        vectorEffect="non-scaling-stroke"
        markerEnd="url(#timeline-arrow)"
      />,
    );
  }

  if (paths.length === 0) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <marker
          id="timeline-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#E2E8F0" />
        </marker>
      </defs>
      {paths}
    </svg>
  );
}

export function ProjectPlanningView(): JSX.Element {
  const [projects, setProjects] = useState<TimelineProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TimelineViewMode>("week");
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [offsetMonths, setOffsetMonths] = useState(0);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editSub, setEditSub] = useState<TimelineSubProjectDto | null>(null);
  const [editSubProject, setEditSubProject] =
    useState<TimelineProjectDto | null>(null);
  const [milestoneModal, setMilestoneModal] = useState<MilestoneModalProps | null>(
    null,
  );
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<TimelineProjectDto | null>(
    null,
  );
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [pickRangeStart, setPickRangeStart] = useState("");
  const [pickRangeEnd, setPickRangeEnd] = useState("");
  const rangeMenuRef = useRef<HTMLDivElement>(null);
  const [emptyDatesHover, setEmptyDatesHover] = useState<{
    subId: number;
    col: number;
  } | null>(null);
  const [editPlannedPreset, setEditPlannedPreset] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadErr(null);
    const res = await fetch("/api/projects/timeline");
    if (!res.ok) {
      setLoadErr("Could not load timeline");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as ProjectsTimelineResponse;
    setProjects(data.projects);
    setExpanded(new Set(data.projects.map((p) => p.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!rangeMenuOpen) {
      return;
    }
    const onDoc = (e: Event): void => {
      if (
        rangeMenuRef.current &&
        !rangeMenuRef.current.contains(e.target as Node)
      ) {
        setRangeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [rangeMenuOpen]);

  useEffect(() => {
    if (!pickRangeStart) {
      return;
    }
    try {
      setPickRangeEnd(pickerEndYmdFromStart(pickRangeStart, viewMode));
    } catch {
      /* invalid */
    }
  }, [pickRangeStart, viewMode]);

  const anchor = useMemo(() => startOfUtcDay(new Date()), []);
  const todayYmd = useMemo(() => formatYmd(anchor), [anchor]);

  const { rangeStart, rangeEndInclusive, columnCount } = useMemo(
    () =>
      getTimelineRange(viewMode, anchor, offsetWeeks, offsetMonths),
    [viewMode, anchor, offsetWeeks, offsetMonths],
  );

  const headers = useMemo(
    () => columnLabels(viewMode, rangeStart, columnCount),
    [viewMode, rangeStart, columnCount],
  );

  const todayPct = percentForDateInRange(
    todayYmd,
    rangeStart,
    rangeEndInclusive,
  );

  const filtered = useMemo(
    () => filterProjects(projects, search),
    [projects, search],
  );

  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    for (const p of filtered) {
      const isEx = expanded.has(p.id);
      r.push({ kind: "project", project: p });
      if (isEx) {
        for (const s of p.subProjects) {
          r.push({ kind: "sub", project: p, sub: s });
        }
      }
    }
    return r;
  }, [filtered, expanded]);

  const rowIndexBySubId = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((row, i) => {
      if (row.kind === "sub") {
        m.set(row.sub.id, i);
      }
    });
    return m;
  }, [rows]);

  const toggleProject = (id: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderTrackRow = (
    row: Row,
    rowIdx: number,
  ): JSX.Element => {
    const nCols = columnCount;
    const gridCols = `repeat(${nCols}, minmax(0, 1fr))`;

    if (row.kind === "project") {
      const p = row.project;
      const { start, end } = parentSpan(p.subProjects);
      const layout = barLayoutForRange(start, end, rangeStart, rangeEndInclusive);
      const barHex = getProjectColor(p.colorKey);
      const projMs = p.milestones
        .map((m) => ({
          m,
          pct: percentForDateInRange(m.targetDate, rangeStart, rangeEndInclusive),
        }))
        .filter((x): x is { m: TimelineMilestoneDto; pct: number } => x.pct != null);
      const spanTip =
        start && end
          ? `${formatFriendlyDayMonthUtc(parseYmdToUtcMidnight(start))} – ${formatFriendlyDayMonthUtc(parseYmdToUtcMidnight(end))}`
          : "No span (sub-projects lack dates)";

      return (
        <div
          key={`p-${p.id}-${rowIdx}`}
          className="relative grid min-h-[44px] border-b border-border bg-white"
          style={{
            gridTemplateColumns: gridCols,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 z-0 grid"
            style={{ gridTemplateColumns: gridCols }}
          >
            {Array.from({ length: nCols }, (_, i) => (
              <div key={i} className="border-r border-border/50" />
            ))}
          </div>
          <div className="relative z-[2] col-span-full flex items-center px-0">
            {layout ? (
              <TimelineTooltip
                tip={
                  <div className="space-y-1">
                    <div className="font-medium text-text-primary">{p.name}</div>
                    <div className="text-text-secondary">{spanTip}</div>
                    <div className="text-text-secondary">
                      Roll-up of sub-project planned dates
                    </div>
                  </div>
                }
              >
                <div
                  className="absolute top-1/2 h-4 -translate-y-1/2 cursor-default rounded-full"
                  style={{
                    left: `${layout.leftPct}%`,
                    width: `${layout.widthPct}%`,
                    backgroundColor: barHex,
                  }}
                />
              </TimelineTooltip>
            ) : null}
            {projMs.map(({ m, pct }) => (
              <TimelineTooltip
                key={m.id}
                tip={
                  <div className="space-y-1">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-text-secondary">
                      Target:{" "}
                      {formatFriendlyDayMonthUtc(
                        parseYmdToUtcMidnight(m.targetDate),
                      )}{" "}
                      ({m.targetDate})
                    </div>
                    <div className="text-text-secondary">
                      {milestoneStatusTip(m, todayYmd)}
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  className="absolute z-20 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0"
                  style={{
                    left: `${pct}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%) rotate(45deg)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMilestoneModal({
                      mode: "edit",
                      milestoneId: m.id,
                      initial: {
                        name: m.name,
                        targetDate: m.targetDate,
                        status: m.status,
                      },
                      onClose: () => setMilestoneModal(null),
                      onSaved: () => void load(),
                    });
                  }}
                >
                  <span
                    className="block h-2.5 w-2.5"
                    style={{
                      backgroundColor: milestoneColor(m, todayYmd),
                    }}
                    aria-hidden
                  />
                </button>
              </TimelineTooltip>
            ))}
          </div>
        </div>
      );
    }

    const { sub, project: proj } = row;
    const layout = barLayoutForRange(
      sub.plannedStart,
      sub.plannedEnd,
      rangeStart,
      rangeEndInclusive,
    );
    const baseCls = subStatusBarClass(sub.status);
    const plannedH = plannedHoursFromYmd(sub.plannedStart, sub.plannedEnd);
    const actualH = sub.actualMinutes / 60;
    const overlayW =
      layout && plannedH > 0
        ? Math.min(100, (actualH / plannedH) * 100)
        : 0;

    const ghost = barLayoutForRange(
      sub.baselineStart,
      sub.baselineEnd,
      rangeStart,
      rangeEndInclusive,
    );

    const subMs = sub.milestones
      .map((m) => ({
        m,
        pct: percentForDateInRange(m.targetDate, rangeStart, rangeEndInclusive),
      }))
      .filter((x): x is { m: TimelineMilestoneDto; pct: number } => x.pct != null);

    const rowTint = hexWithAlpha(
      getProjectColor(proj.colorKey),
      PROJECT_ROW_TINT_ALPHA,
    );
    const barOpenEditor = (): void => {
      setEditPlannedPreset(null);
      const fp = projects.find((p) => p.id === proj.id);
      if (!fp) {
        return;
      }
      const fs = fp.subProjects.find((s) => s.id === sub.id) ?? sub;
      setEditSub(fs);
      setEditSubProject(fp);
    };
    const openSubEditorWithPreset = (startYmd: string, endYmd: string): void => {
      setEditPlannedPreset({ start: startYmd, end: endYmd });
      const fp = projects.find((p) => p.id === proj.id);
      if (!fp) {
        return;
      }
      const fs = fp.subProjects.find((s) => s.id === sub.id) ?? sub;
      setEditSub(fs);
      setEditSubProject(fp);
    };

    let hoverPlaceholderLayout: ReturnType<typeof barLayoutForRange> = null;
    if (
      !layout &&
      emptyDatesHover?.subId === sub.id &&
      emptyDatesHover.col >= 0 &&
      emptyDatesHover.col < nCols
    ) {
      const ms = columnMonthStartForSpan(
        viewMode,
        rangeStart,
        emptyDatesHover.col,
      );
      const { startYmd, endYmd } = twoMonthSpanYmdsFromMonthStart(ms);
      hoverPlaceholderLayout = barLayoutForRange(
        startYmd,
        endYmd,
        rangeStart,
        rangeEndInclusive,
      );
    }
    const plannedTip = (
      <div className="space-y-1">
        <div className="font-medium text-text-primary">{sub.name}</div>
        <div className="text-text-secondary">{subStatusLabel(sub.status)}</div>
        {sub.plannedStart && sub.plannedEnd ? (
          <div className="text-text-secondary">
            Planned:{" "}
            {formatFriendlyDayMonthUtc(parseYmdToUtcMidnight(sub.plannedStart))} –{" "}
            {formatFriendlyDayMonthUtc(parseYmdToUtcMidnight(sub.plannedEnd))}
          </div>
        ) : null}
        {sub.baselineStart && sub.baselineEnd ? (
          <div className="text-text-secondary">
            Baseline:{" "}
            {formatFriendlyDayMonthUtc(parseYmdToUtcMidnight(sub.baselineStart))} –{" "}
            {formatFriendlyDayMonthUtc(parseYmdToUtcMidnight(sub.baselineEnd))}
          </div>
        ) : null}
        <div className="text-text-secondary">
          Hours: {plannedH}h planned · {actualH.toFixed(1)}h logged
        </div>
        {plannedH > 0 ? (
          <div className="text-text-secondary">
            Progress vs plan: {Math.min(100, (actualH / plannedH) * 100).toFixed(0)}%
          </div>
        ) : null}
      </div>
    );

    return (
      <div
        key={`s-${sub.id}-${rowIdx}`}
        className="relative grid min-h-[44px] border-b border-border"
        style={{
          gridTemplateColumns: gridCols,
          backgroundColor: rowTint,
        }}
        onMouseLeave={
          !layout
            ? () =>
                setEmptyDatesHover((h) =>
                  h?.subId === sub.id ? null : h,
                )
            : undefined
        }
      >
        <div
          className="pointer-events-none absolute inset-0 z-0 grid"
          style={{ gridTemplateColumns: gridCols }}
        >
          {Array.from({ length: nCols }, (_, i) => (
            <div key={i} className="border-r border-border/50" />
          ))}
        </div>
        <div className="relative z-[2] col-span-full flex items-center px-0">
          {ghost ? (
            <div
              className="pointer-events-none absolute h-[22px] rounded-full bg-text-secondary/25"
              style={{
                left: `${ghost.leftPct}%`,
                width: `${ghost.widthPct}%`,
              }}
            />
          ) : null}
          {layout ? (
            <TimelineTooltip tip={plannedTip}>
              <button
                type="button"
                className={`absolute h-[22px] rounded-full ${baseCls} transition-opacity hover:opacity-90`}
                style={{
                  left: `${layout.leftPct}%`,
                  width: `${layout.widthPct}%`,
                }}
                onClick={barOpenEditor}
              >
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 rounded-l-full bg-black/40"
                  style={{ width: `${overlayW}%` }}
                />
              </button>
            </TimelineTooltip>
          ) : (
            <>
              {hoverPlaceholderLayout ? (
                <div
                  className="pointer-events-none absolute top-1/2 h-[22px] -translate-y-1/2 rounded-full border border-dashed border-text-secondary/50 bg-text-secondary/[0.09]"
                  style={{
                    left: `${hoverPlaceholderLayout.leftPct}%`,
                    width: `${hoverPlaceholderLayout.widthPct}%`,
                  }}
                />
              ) : null}
              <div
                className="absolute inset-0 z-[5] grid"
                style={{ gridTemplateColumns: gridCols }}
              >
                {Array.from({ length: nCols }, (_, i) => (
                  <button
                    key={`hit-${sub.id}-${i}`}
                    type="button"
                    aria-label="Set dates for this period"
                    className="relative h-full min-h-[44px] w-full cursor-pointer border-0 bg-transparent p-0"
                    onMouseEnter={() =>
                      setEmptyDatesHover({ subId: sub.id, col: i })
                    }
                    onClick={() => {
                      const ms = columnMonthStartForSpan(
                        viewMode,
                        rangeStart,
                        i,
                      );
                      const { startYmd, endYmd } =
                        twoMonthSpanYmdsFromMonthStart(ms);
                      openSubEditorWithPreset(startYmd, endYmd);
                    }}
                  />
                ))}
              </div>
            </>
          )}
          {subMs.map(({ m, pct }) => (
            <TimelineTooltip
              key={m.id}
              tip={
                <div className="space-y-1">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-text-secondary">
                    Target:{" "}
                    {formatFriendlyDayMonthUtc(
                      parseYmdToUtcMidnight(m.targetDate),
                    )}{" "}
                    ({m.targetDate})
                  </div>
                  <div className="text-text-secondary">
                    {milestoneStatusTip(m, todayYmd)}
                  </div>
                </div>
              }
            >
              <button
                type="button"
                className="absolute z-20 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0"
                style={{
                  left: `${pct}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%) rotate(45deg)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMilestoneModal({
                    mode: "edit",
                    milestoneId: m.id,
                    initial: {
                      name: m.name,
                      targetDate: m.targetDate,
                      status: m.status,
                    },
                    onClose: () => setMilestoneModal(null),
                    onSaved: () => void load(),
                  });
                }}
              >
                <span
                  className="block h-2.5 w-2.5"
                  style={{ backgroundColor: milestoneColor(m, todayYmd) }}
                />
              </button>
            </TimelineTooltip>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    const gridCols = `repeat(${columnCount}, minmax(0, 1fr))`;
    const skeletonRowCount = 8;

    return (
      <div
        className="space-y-4"
        role="status"
        aria-busy="true"
        aria-label="Loading timeline"
      >
        <div className="grid w-full grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 md:justify-start">
            <Skeleton className="h-9 w-[8.5rem] shrink-0 rounded-input" />
            <Skeleton className="h-10 min-w-[12rem] max-w-md flex-1 rounded-input" />
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-9 w-[11rem] rounded-input" />
          </div>
          <div className="flex justify-center gap-2 md:justify-end">
            <Skeleton className="h-10 w-[7.5rem] rounded-input" />
            <Skeleton className="h-10 w-[6.5rem] rounded-input" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-[720px]">
            <div className="sticky left-0 z-20 w-[260px] shrink-0 border border-border bg-surface">
              <div className="border-b border-border py-3 pl-3 pr-2 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                Project / Sub-project
              </div>
              {Array.from({ length: skeletonRowCount }, (_, i) => (
                <div
                  key={`sk-l-${i}`}
                  className={`flex min-h-[44px] items-center gap-2 border-b border-border py-2 pl-1 pr-2 ${
                    i % 3 === 0 ? "bg-white" : ""
                  }`}
                >
                  {i % 3 === 0 ? (
                    <>
                      <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
                      <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                      <Skeleton className="h-4 min-w-0 flex-1 rounded-md" />
                      <Skeleton className="h-3 w-12 shrink-0 rounded-md" />
                    </>
                  ) : (
                    <>
                      <span className="w-4 shrink-0" aria-hidden />
                      <Skeleton className="h-4 min-w-0 flex-1 rounded-md" />
                      <Skeleton className="h-3 w-14 shrink-0 rounded-md" />
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="relative min-w-0 flex-1 border border-l-0 border-border bg-surface">
              <div
                className="relative z-10 grid h-11 shrink-0 items-center border-b border-border"
                style={{ gridTemplateColumns: gridCols }}
              >
                {headers.map((h, hi) => (
                  <div
                    key={`sk-h-${hi}-${h}`}
                    className="border-r border-border/50 px-1 text-center text-[11px] text-text-secondary"
                  >
                    {h}
                  </div>
                ))}
              </div>
              <div className="relative min-h-0">
                {Array.from({ length: skeletonRowCount }, (_, i) => {
                  const leftPct = 4 + (i * 11) % 48;
                  const widthPct = 18 + (i % 4) * 12;
                  return (
                    <div
                      key={`sk-t-${i}`}
                      className={`relative grid min-h-[44px] border-b border-border ${
                        i % 3 === 0 ? "bg-white" : ""
                      }`}
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 z-0 grid"
                        style={{ gridTemplateColumns: gridCols }}
                      >
                        {Array.from({ length: columnCount }, (_, j) => (
                          <div
                            key={j}
                            className="border-r border-border/50"
                          />
                        ))}
                      </div>
                      <div className="relative z-[2] col-span-full flex items-center px-0">
                        <Skeleton
                          className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadErr) {
    return (
      <p className="text-sm text-danger" role="alert">
        {loadErr}
      </p>
    );
  }

  const friendlyRangeLabel = formatInclusiveRangeLabel(
    rangeStart,
    rangeEndInclusive,
  );

  const openRangePicker = (): void => {
    setPickRangeStart(formatYmd(rangeStart));
    setRangeMenuOpen(true);
  };

  const applyRangePicker = (): void => {
    try {
      const d = parseYmdToUtcMidnight(pickRangeStart);
      if (viewMode === "week") {
        setOffsetWeeks(offsetWeeksForTimelineRangeStart(anchor, d));
      } else {
        setOffsetMonths(offsetMonthsForTimelineRangeStart(anchor, d));
      }
    } catch {
      /* invalid date input */
    }
    setRangeMenuOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid w-full grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 md:justify-start">
          <div className="inline-flex shrink-0 rounded-input border border-border/80 bg-appbg/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
                viewMode === "week"
                  ? "border border-border bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
                viewMode === "month"
                  ? "border border-border bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary"
              }`}
            >
              Month
            </button>
          </div>
          <input
            type="search"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 w-full max-w-md flex-1 rounded-input border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-center">
          <div className="relative" ref={rangeMenuRef}>
            <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-0.5 shadow-sm">
              <button
                type="button"
                aria-label="Earlier range"
                className="shrink-0 rounded border border-transparent px-1.5 py-0.5 text-sm hover:bg-appbg active:scale-95"
                onClick={() =>
                  viewMode === "week"
                    ? setOffsetWeeks((o) => o - 1)
                    : setOffsetMonths((o) => o - 1)
                }
              >
                ←
              </button>
              <button
                type="button"
                className="max-w-[10rem] min-w-0 truncate px-1 py-0.5 text-center text-[11px] leading-tight text-text-secondary underline decoration-border decoration-dotted underline-offset-2 hover:text-text-primary"
                onClick={openRangePicker}
              >
                {friendlyRangeLabel}
              </button>
              <button
                type="button"
                aria-label="Later range"
                className="shrink-0 rounded border border-transparent px-1.5 py-0.5 text-sm hover:bg-appbg active:scale-95"
                onClick={() =>
                  viewMode === "week"
                    ? setOffsetWeeks((o) => o + 1)
                    : setOffsetMonths((o) => o + 1)
                }
              >
                →
              </button>
            </div>
            {rangeMenuOpen ? (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-[min(100vw-2rem,240px)] -translate-x-1/2 rounded-card border border-border bg-surface p-4 shadow-card">
                <p className="mb-2 text-xs text-text-secondary">
                  Jump to timeline window starting at:
                </p>
                <label className="block text-xs text-text-secondary">
                  Start date
                  <input
                    type="date"
                    value={pickRangeStart}
                    onChange={(e) => setPickRangeStart(e.target.value)}
                    className="mt-1 w-full rounded-input border border-border px-2 py-1.5 text-sm"
                  />
                </label>
                <p className="mt-2 text-[11px] leading-snug text-text-secondary">
                  Visible end (
                  {viewMode === "week" ? "13 weeks" : "6 months"}
                  ):{" "}
                  <span className="font-medium text-text-primary">
                    {pickRangeEnd
                      ? formatFriendlyDayMonthUtc(
                          parseYmdToUtcMidnight(pickRangeEnd),
                        )
                      : "—"}
                  </span>
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-input border border-border px-3 py-1.5 text-sm"
                    onClick={() => setRangeMenuOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-input bg-primary px-3 py-1.5 text-sm font-medium text-white"
                    onClick={applyRangePicker}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex justify-center gap-2 md:justify-end">
          <button
            type="button"
            disabled={projects.length === 0}
            onClick={() =>
              setMilestoneModal({
                mode: "create",
                projects,
                initial: {
                  name: "",
                  targetDate: todayYmd,
                },
                onClose: () => setMilestoneModal(null),
                onSaved: () => void load(),
              })
            }
            className="rounded-input border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary active:scale-[0.97] disabled:opacity-50"
          >
            + Milestone
          </button>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white active:scale-[0.97]"
          >
            + Project
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[720px]">
          <div className="sticky left-0 z-20 w-[260px] shrink-0 border border-border bg-surface">
            <div className="border-b border-border py-3 pl-3 pr-2 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              Project / Sub-project
            </div>
            {rows.map((row, rowIdx) => (
              <div
                key={
                  row.kind === "project"
                    ? `l-p-${row.project.id}-${rowIdx}`
                    : `l-s-${row.sub.id}-${rowIdx}`
                }
                className={`flex min-h-[44px] items-center gap-2 border-b border-border py-2 pl-1 pr-2 ${
                  row.kind === "project" ? "bg-white" : ""
                }`}
                style={
                  row.kind === "sub"
                    ? {
                        backgroundColor: hexWithAlpha(
                          getProjectColor(row.project.colorKey),
                          PROJECT_ROW_TINT_ALPHA,
                        ),
                      }
                    : undefined
                }
              >
                {row.kind === "project" ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={expanded.has(row.project.id)}
                      className="shrink-0 text-text-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProject(row.project.id);
                      }}
                    >
                      {expanded.has(row.project.id) ? "▼" : "▶"}
                    </button>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 shadow-sm"
                      style={{
                        backgroundColor: getProjectColor(row.project.colorKey),
                      }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium text-text-primary hover:underline"
                      onClick={() => setEditProject(row.project)}
                    >
                      {row.project.name}
                    </button>
                    <span className="max-w-[6rem] shrink-0 truncate text-end text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      {projectAlertLabel(
                        projectAlert(row.project.subProjects, todayYmd),
                      ).toUpperCase()}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {displaySubProjectName(row.project.name, row.sub.name)}
                    </span>
                    <span className="max-w-[6rem] shrink-0 truncate text-end text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      {subStatusLabel(row.sub.status).toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="relative min-w-0 flex-1 border border-l-0 border-border bg-surface">
            <div
              className="relative z-10 grid h-11 shrink-0 items-center border-b border-border"
              style={{
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              }}
            >
              {headers.map((h, hi) => (
                <div
                  key={`h-${hi}-${h}`}
                  className="border-r border-border/50 px-1 text-center text-[11px] text-text-secondary"
                >
                  {h}
                </div>
              ))}
            </div>
            <div className="relative min-h-0">
              {todayPct != null ? (
                <div
                  className="pointer-events-none absolute inset-y-0 z-30 w-px bg-danger"
                  style={{ left: `${todayPct}%` }}
                  title="Today"
                  aria-hidden
                />
              ) : null}
              <DependencyCurves
                rows={rows}
                rowIndexBySubId={rowIndexBySubId}
                rangeStart={rangeStart}
                rangeEndInclusive={rangeEndInclusive}
              />
              {rows.map((row, rowIdx) => renderTrackRow(row, rowIdx))}
            </div>
          </div>
        </div>
      </div>

      {editSub && editSubProject ? (
        <SubProjectEditModal
          sub={editSub}
          siblings={editSubProject.subProjects}
          initialPlannedStart={editPlannedPreset?.start}
          initialPlannedEnd={editPlannedPreset?.end}
          onClose={() => {
            setEditSub(null);
            setEditSubProject(null);
            setEditPlannedPreset(null);
          }}
          onSaved={() => void load()}
        />
      ) : null}

      {milestoneModal ? <MilestoneModal {...milestoneModal} /> : null}

      {editProject ? (
        <EditProjectModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={() => void load()}
        />
      ) : null}

      {newProjectOpen ? (
        <NewProjectModal
          usedColorKeys={projects.map((p) => p.colorKey)}
          onClose={() => setNewProjectOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}
    </div>
  );
}
