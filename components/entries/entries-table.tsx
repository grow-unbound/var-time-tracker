"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type {
  BatteryDto,
  DepartmentDto,
  EntriesListResponse,
  ProjectDto,
  TimeEntryListItemDto,
} from "@/lib/api-dtos";
import type { TimeScope } from "@/lib/dashboard-date-range";

import { AppFiltersPanel } from "@/components/filters/app-filters-panel";
import { EntriesTableBodySkeletonRows } from "@/components/entries/entries-table-skeleton";

const STORAGE_KEY = "var-tracker:entriesLastSeenAt";

const SORT_FIELDS = [
  "date",
  "employee",
  "department",
  "project",
  "battery",
  "lot",
  "stage",
  "activity",
  "duration",
] as const;

const ROW_LIMITS = [10, 20, 50, 100] as const;

type SortField = (typeof SORT_FIELDS)[number];

function isSortField(s: string | null): s is SortField {
  return s !== null && (SORT_FIELDS as readonly string[]).includes(s);
}

function parseCommaIds(param: string | null): number[] {
  if (!param?.trim()) return [];
  return Array.from(
    new Set(
      param
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  );
}

function parseTimeScope(s: string | null): TimeScope {
  if (
    s === "today" ||
    s === "yesterday" ||
    s === "week" ||
    s === "month" ||
    s === "year" ||
    s === "all"
  ) {
    return s;
  }
  return "all";
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatLastEntryRelative(iso: string | null): string {
  if (!iso) {
    return "No entries yet";
  }
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) {
    return "Just now";
  }
  if (mins < 60) {
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return `${hours}h ${rem}m ago`;
}

function stageBadgeClasses(stage: TimeEntryListItemDto["stage"]): string {
  if (stage === "RnD") {
    return "bg-primary text-white";
  }
  return "bg-accent text-text-primary";
}

function stageLabel(stage: TimeEntryListItemDto["stage"]): string {
  return stage === "RnD" ? "R&D" : "Production";
}

export interface EntriesListUrlState {
  page: number;
  limit: number;
  q: string;
  sortBy: SortField | null;
  sortDir: "asc" | "desc";
  scope: TimeScope;
  deptIds: number[];
  projectIds: number[];
  batteryIds: number[];
}

function buildEntriesQueryString(state: EntriesListUrlState): string {
  const sp = new URLSearchParams();
  if (state.page > 1) sp.set("page", String(state.page));
  if (state.limit !== 20) sp.set("limit", String(state.limit));
  if (state.q.trim()) sp.set("q", state.q.trim());
  if (state.sortBy) {
    sp.set("sortBy", state.sortBy);
    sp.set("sortDir", state.sortDir);
  }
  if (state.scope !== "all") sp.set("scope", state.scope);
  if (state.deptIds.length > 0) sp.set("depts", state.deptIds.join(","));
  if (state.projectIds.length > 0) sp.set("projects", state.projectIds.join(","));
  if (state.batteryIds.length > 0) {
    sp.set("batteries", state.batteryIds.join(","));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function parseUrlState(sp: URLSearchParams): EntriesListUrlState {
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const rawLimit = Number(sp.get("limit")) || 20;
  const limit = ROW_LIMITS.includes(rawLimit as (typeof ROW_LIMITS)[number])
    ? rawLimit
    : 20;
  const q = sp.get("q") ?? "";
  const sortRaw = sp.get("sortBy");
  const sortBy = isSortField(sortRaw) ? sortRaw : null;
  const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const scope = parseTimeScope(sp.get("scope"));

  return {
    page,
    limit,
    q,
    sortBy,
    sortDir,
    scope,
    deptIds: parseCommaIds(sp.get("depts")),
    projectIds: parseCommaIds(sp.get("projects")),
    batteryIds: parseCommaIds(sp.get("batteries")),
  };
}

export function EntriesTable(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();

  const urlState = useMemo(
    () => parseUrlState(urlSearchParams),
    [urlSearchParams],
  );

  const [lastSeenThreshold] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const visitRecordedRef = useRef(false);

  const [searchDraft, setSearchDraft] = useState(urlState.q);
  const [data, setData] = useState<EntriesListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [batteries, setBatteries] = useState<BatteryDto[]>([]);
  const [filtersError, setFiltersError] = useState<string | null>(null);

  useEffect(() => {
    setSearchDraft(urlState.q);
  }, [urlState.q]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [dRes, pRes, bRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/projects"),
          fetch("/api/batteries"),
        ]);
        if (!dRes.ok || !pRes.ok || !bRes.ok) {
          throw new Error("Failed to load filter options");
        }
        const dJson = (await dRes.json()) as { departments: DepartmentDto[] };
        const pJson = (await pRes.json()) as { projects: ProjectDto[] };
        const bJson = (await bRes.json()) as { batteries: BatteryDto[] };
        if (!cancelled) {
          setDepartments(dJson.departments);
          setProjects(pJson.projects);
          setBatteries(bJson.batteries);
        }
      } catch (e) {
        if (!cancelled) {
          setFiltersError(
            e instanceof Error ? e.message : "Failed to load filters",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navigate = useCallback(
    (next: Partial<EntriesListUrlState>) => {
      const merged: EntriesListUrlState = {
        ...urlState,
        ...next,
      };
      router.replace(`${pathname}${buildEntriesQueryString(merged)}`, {
        scroll: false,
      });
    },
    [pathname, router, urlState],
  );

  const fetchUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(urlState.page));
    sp.set("limit", String(urlState.limit));
    const qt = urlState.q.trim();
    if (qt) sp.set("q", qt);
    if (urlState.sortBy) {
      sp.set("sortBy", urlState.sortBy);
      sp.set("sortDir", urlState.sortDir);
    }
    if (urlState.scope !== "all") sp.set("scope", urlState.scope);
    if (urlState.deptIds.length) sp.set("depts", urlState.deptIds.join(","));
    if (urlState.projectIds.length) {
      sp.set("projects", urlState.projectIds.join(","));
    }
    if (urlState.batteryIds.length) {
      sp.set("batteries", urlState.batteryIds.join(","));
    }
    return `/api/entries?${sp.toString()}`;
  }, [urlState]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const res = await fetch(fetchUrl);
        const json: unknown = await res.json();
        if (!res.ok) {
          const err =
            typeof json === "object" &&
            json !== null &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
              ? (json as { error: string }).error
              : "Failed to load entries";
          if (!cancelled) setLoadError(err);
          return;
        }
        if (!cancelled) {
          setData(json as EntriesListResponse);
        }
      } catch {
        if (!cancelled) setLoadError("Failed to load entries");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  useEffect(() => {
    if (loading || loadError || data === null || visitRecordedRef.current) return;
    visitRecordedRef.current = true;
    try {
      sessionStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }, [loading, loadError, data]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate({ q: value, page: 1 });
      }, 350);
    },
    [navigate],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const onSortColumn = useCallback(
    (field: SortField) => {
      const same = urlState.sortBy === field;
      const nextDir: "asc" | "desc" = same
        ? urlState.sortDir === "asc"
          ? "desc"
          : "asc"
        : field === "date" || field === "duration"
          ? "desc"
          : "asc";
      navigate({
        page: 1,
        sortBy: field,
        sortDir: nextDir,
      });
    },
    [navigate, urlState.sortBy, urlState.sortDir],
  );

  const thresholdMs = lastSeenThreshold
    ? Date.parse(lastSeenThreshold)
    : NaN;
  const showNew = (row: TimeEntryListItemDto): boolean => {
    if (lastSeenThreshold === null || Number.isNaN(thresholdMs)) return false;
    return Date.parse(row.createdAt) > thresholdMs;
  };

  const entries = data?.entries ?? [];
  const totalPages = data?.totalPages ?? 0;

  const sortHeader = (field: SortField, label: string) => {
    const active = urlState.sortBy === field;
    const arrow = active
      ? urlState.sortDir === "asc"
        ? " \u2191"
        : " \u2193"
      : "";
    return (
      <th scope="col" className="px-3 py-2 text-left font-medium text-text-primary">
        <button
          type="button"
          onClick={() => onSortColumn(field)}
          className="inline-flex items-center gap-1 rounded-input px-1 py-0.5 text-left text-xs font-medium uppercase tracking-wide text-text-secondary hover:bg-appbg hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {label}
          {active ? (
            <span className="font-mono text-text-primary">{arrow}</span>
          ) : null}
        </button>
      </th>
    );
  };

  const onClearFilters = useCallback(() => {
    navigate({
      scope: "all",
      deptIds: [],
      projectIds: [],
      batteryIds: [],
      page: 1,
    });
  }, [navigate]);

  return (
    <div className="space-y-4">
      {filtersError ? (
        <p className="text-xs text-danger" role="alert">
          {filtersError}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:gap-4">
        <label className="flex min-w-[200px] max-w-md flex-1 flex-col gap-1 text-xs font-medium text-text-secondary">
          Search
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-sm placeholder:text-text-secondary/70"
            autoComplete="off"
          />
        </label>
        <AppFiltersPanel
          timeScope={urlState.scope}
          onTimeScopeChange={(next) => navigate({ scope: next, page: 1 })}
          departments={departments}
          projects={projects}
          batteries={batteries}
          selectedDeptIds={urlState.deptIds}
          selectedProjectIds={urlState.projectIds}
          selectedBatteryIds={urlState.batteryIds}
          onDeptChange={(ids) => navigate({ deptIds: ids, page: 1 })}
          onProjectChange={(ids) => navigate({ projectIds: ids, page: 1 })}
          onBatteryChange={(ids) => navigate({ batteryIds: ids, page: 1 })}
          showClearFilters
          onClearFilters={onClearFilters}
        />
      </div>

      {loadError ? (
        <p className="text-sm text-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-input border border-border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-appbg">
              {sortHeader("date", "Date")}
              {sortHeader("employee", "Employee")}
              {sortHeader("department", "Department")}
              {sortHeader("activity", "Activity")}
              {sortHeader("project", "Project")}
              {sortHeader("battery", "Battery")}
              {sortHeader("lot", "Lot")}
              {sortHeader("stage", "Stage")}
              {sortHeader("duration", "Duration")}
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {loading ? (
              <EntriesTableBodySkeletonRows
                rows={Math.min(Math.max(urlState.limit, 1), 20)}
              />
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-text-secondary">
                  No entries match your filters.
                </td>
              </tr>
            ) : (
              entries.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-text-primary">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.entryDate}
                      {showNew(row) ? (
                        <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                          NEW
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-primary">{row.employeeLabel}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.departmentName}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.activityName}</td>
                  <td className="px-3 py-2 text-text-primary">{row.projectName}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.batteryModelName}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {row.lotNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stageBadgeClasses(row.stage)}`}
                    >
                      {stageLabel(row.stage)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-text-primary">
                    {formatDuration(row.durationMinutes)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Last entry:{" "}
          <span className="font-medium text-text-primary">
            {formatLastEntryRelative(data?.lastEntryAt ?? null)}
          </span>
        </p>

        <p className="text-xs text-text-secondary">
          {data?.total} {data?.total === 1 ? "entry" : "entries"}
        </p>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Rows per page
            <select
              value={urlState.limit}
              onChange={(e) => {
                const limit = Number(e.target.value);
                navigate({
                  limit: ROW_LIMITS.includes(
                    limit as (typeof ROW_LIMITS)[number],
                  )
                    ? limit
                    : 20,
                  page: 1,
                });
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
                disabled={urlState.page <= 1 || loading}
                onClick={() => navigate({ page: 1 })}
                className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                disabled={urlState.page <= 1 || loading}
                onClick={() => navigate({ page: urlState.page - 1 })}
                className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-text-secondary">
                Page {urlState.page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={urlState.page >= totalPages || loading}
                onClick={() => navigate({ page: urlState.page + 1 })}
                className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                disabled={urlState.page >= totalPages || loading}
                onClick={() => navigate({ page: totalPages })}
                className="rounded-input border border-border bg-surface px-2 py-1.5 font-medium text-text-primary disabled:opacity-40"
              >
                Last
              </button>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
