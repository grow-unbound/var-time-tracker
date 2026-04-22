"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ProjectsTimelineResponse,
  SubProjectStatusDto,
  TimelineMilestoneDto,
  TimelineProjectDto,
  TimelineSubProjectDto,
} from "@/lib/api-dtos";
import { getProjectColor } from "@/lib/constants";
import {
  barLayoutForRange,
  percentForDateInRange,
  plannedHoursFromYmd,
} from "@/lib/timeline-geometry";
import {
  columnLabels,
  formatYmd,
  getTimelineRange,
  startOfUtcDay,
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

function AlertDot({ kind }: { kind: AlertKind }): JSX.Element {
  const cls =
    kind === "overdue"
      ? "bg-danger"
      : kind === "slipped"
        ? "bg-accent"
        : kind === "no_dates"
          ? "bg-border"
          : kind === "on_track"
            ? "bg-success"
            : "bg-text-secondary/40";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`}
      title={kind}
      aria-hidden
    />
  );
}

function subStatusBarClass(status: SubProjectStatusDto): string {
  switch (status) {
    case "not_started":
      return "bg-border";
    case "in_progress":
      return "bg-primary";
    case "completed":
      return "bg-success";
    case "on_hold":
      return "bg-accent";
    default:
      return "bg-border";
  }
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

interface SubProjectEditModalProps {
  sub: TimelineSubProjectDto;
  siblings: TimelineSubProjectDto[];
  onClose: () => void;
  onSaved: () => void;
}

function SubProjectEditModal({
  sub,
  siblings,
  onClose,
  onSaved,
}: SubProjectEditModalProps): JSX.Element {
  const [status, setStatus] = useState<SubProjectStatusDto>(sub.status);
  const [plannedStart, setPlannedStart] = useState(sub.plannedStart ?? "");
  const [plannedEnd, setPlannedEnd] = useState(sub.plannedEnd ?? "");
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
  initial,
  onClose,
  onSaved,
}: MilestoneModalProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [status, setStatus] = useState<TimelineMilestoneDto["status"]>(
    initial?.status ?? "pending",
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
    if (mode === "create") {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetDate,
          status,
          projectId: initial?.projectId ?? null,
          subProjectId: initial?.subProjectId ?? null,
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
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,400px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-6 shadow-card"
      >
        <h2 id="ms-title" className="text-base font-semibold text-text-primary">
          {mode === "create" ? "New milestone" : "Edit milestone"}
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

interface NewProjectModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewProjectModal({
  onClose,
  onCreated,
}: NewProjectModalProps): JSX.Element {
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
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
          New project
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

      return (
        <div
          key={`p-${p.id}-${rowIdx}`}
          className="relative grid min-h-[44px] border-b border-border"
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
              <div
                className="absolute h-2 rounded-full"
                style={{
                  left: `${layout.leftPct}%`,
                  width: `${layout.widthPct}%`,
                  backgroundColor: barHex,
                }}
                title={`${p.name}`}
              />
            ) : null}
            {projMs.map(({ m, pct }) => (
              <button
                key={m.id}
                type="button"
                className="absolute z-20 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0"
                style={{
                  left: `${pct}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%) rotate(45deg)",
                }}
                title={`${m.name} · ${m.targetDate}`}
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

    return (
      <div
        key={`s-${sub.id}-${rowIdx}`}
        className="relative grid min-h-[44px] border-b border-border"
        style={{ gridTemplateColumns: gridCols }}
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
            <button
              type="button"
              title={`Planned: ${plannedH}h | Logged: ${actualH.toFixed(1)}h`}
              className={`absolute h-[22px] rounded-full ${baseCls} transition-opacity hover:opacity-90`}
              style={{
                left: `${layout.leftPct}%`,
                width: `${layout.widthPct}%`,
              }}
              onClick={() => {
                const fp = projects.find((p) => p.id === proj.id);
                if (!fp) {
                  return;
                }
                const fs = fp.subProjects.find((s) => s.id === sub.id) ?? sub;
                setEditSub(fs);
                setEditSubProject(fp);
              }}
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 rounded-l-full bg-black/40"
                style={{ width: `${overlayW}%` }}
              />
            </button>
          ) : (
            <button
              type="button"
              className="absolute left-0 text-xs text-text-secondary underline"
              onClick={() => {
                const fp = projects.find((p) => p.id === proj.id);
                if (!fp) {
                  return;
                }
                const fs = fp.subProjects.find((s) => s.id === sub.id) ?? sub;
                setEditSub(fs);
                setEditSubProject(fp);
              }}
            >
              Set dates
            </button>
          )}
          {subMs.map(({ m, pct }) => (
            <button
              key={m.id}
              type="button"
              className="absolute z-20 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0"
              style={{
                left: `${pct}%`,
                top: "50%",
                transform: "translate(-50%, -50%) rotate(45deg)",
              }}
              title={`${m.name} · ${m.targetDate}`}
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
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <p className="text-sm text-text-secondary" role="status">
        Loading timeline…
      </p>
    );
  }

  if (loadErr) {
    return (
      <p className="text-sm text-danger" role="alert">
        {loadErr}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-input bg-appbg p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
              viewMode === "week"
                ? "bg-primary text-white"
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
                ? "bg-primary text-white"
                : "text-text-secondary"
            }`}
          >
            Month
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Earlier range"
            className="rounded-input border border-border bg-surface px-2 py-1 text-sm active:scale-95"
            onClick={() =>
              viewMode === "week"
                ? setOffsetWeeks((o) => o - 1)
                : setOffsetMonths((o) => o - 1)
            }
          >
            ←
          </button>
          <span className="min-w-[140px] text-center text-xs text-text-secondary">
            {formatYmd(rangeStart)} — {formatYmd(rangeEndInclusive)}
          </span>
          <button
            type="button"
            aria-label="Later range"
            className="rounded-input border border-border bg-surface px-2 py-1 text-sm active:scale-95"
            onClick={() =>
              viewMode === "week"
                ? setOffsetWeeks((o) => o + 1)
                : setOffsetMonths((o) => o + 1)
            }
          >
            →
          </button>
        </div>
        <input
          type="search"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] flex-1 rounded-input border border-border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="rounded-input bg-primary px-4 py-2 text-sm font-medium text-white active:scale-[0.97]"
        >
          + New project
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[720px]">
          <div className="sticky left-0 z-20 w-[260px] shrink-0 border border-border bg-surface">
            <div className="border-b border-border py-3 pl-1 pr-2 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              Project / Sub-project
            </div>
            {rows.map((row, rowIdx) => (
              <div
                key={
                  row.kind === "project"
                    ? `l-p-${row.project.id}-${rowIdx}`
                    : `l-s-${row.sub.id}-${rowIdx}`
                }
                className="flex min-h-[44px] items-center gap-2 border-b border-border py-2 pl-1 pr-2"
              >
                {row.kind === "project" ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={expanded.has(row.project.id)}
                      className="shrink-0 text-text-secondary"
                      onClick={() => toggleProject(row.project.id)}
                    >
                      {expanded.has(row.project.id) ? "▼" : "▶"}
                    </button>
                    <AlertDot
                      kind={projectAlert(row.project.subProjects, todayYmd)}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                      {row.project.name}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[11px] text-accent underline"
                      onClick={() =>
                        setMilestoneModal({
                          mode: "create",
                          initial: {
                            projectId: row.project.id,
                            subProjectId: null,
                            targetDate: todayYmd,
                            name: "",
                          },
                          onClose: () => setMilestoneModal(null),
                          onSaved: () => void load(),
                        })
                      }
                    >
                      + Milestone
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-4 shrink-0" />
                    <AlertDot kind={rowAlert(row.sub, todayYmd)} />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      └ {row.sub.name}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[11px] text-accent underline"
                      onClick={() =>
                        setMilestoneModal({
                          mode: "create",
                          initial: {
                            projectId: null,
                            subProjectId: row.sub.id,
                            targetDate: row.sub.plannedEnd ?? todayYmd,
                            name: "",
                          },
                          onClose: () => setMilestoneModal(null),
                          onSaved: () => void load(),
                        })
                      }
                    >
                      + Milestone
                    </button>
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
              {headers.map((h) => (
                <div
                  key={h}
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
          onClose={() => {
            setEditSub(null);
            setEditSubProject(null);
          }}
          onSaved={() => void load()}
        />
      ) : null}

      {milestoneModal ? <MilestoneModal {...milestoneModal} /> : null}

      {newProjectOpen ? (
        <NewProjectModal
          onClose={() => setNewProjectOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}
    </div>
  );
}
