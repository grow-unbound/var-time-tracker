"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ActivityDto,
  BatteryDto,
  DepartmentDto,
  EmployeeDto,
  LotDto,
  ProjectDto,
  ShiftCheckResponse,
  ShiftDto,
} from "@/lib/api-dtos";
import {
  readReferenceCache,
  writeReferenceCache,
} from "@/lib/reference-cache";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TimeEntryFormSkeleton } from "@/components/time-entry/time-entry-form-skeleton";

interface EntryRowState {
  clientId: string;
  activityId: string;
  projectId: string;
  batteryId: string;
  stage: "RnD" | "Production";
  lotId: string;
  durationMinutes: string;
  batteries: BatteryDto[];
  lots: LotDto[];
}

function normalizeDurationMinutes(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  const n = Math.round(raw / 15) * 15;
  return Math.min(480, Math.max(15, n));
}

function snapDurationMinutes(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  const capped = Math.min(480, raw);
  const snapped = Math.round(capped / 15) * 15;
  return Math.min(480, Math.max(15, snapped));
}

function splitDuration(totalStr: string): { hours: number; minutes: number } {
  const parsed = Number.parseInt(totalStr, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { hours: 0, minutes: 0 };
  }
  const t = normalizeDurationMinutes(parsed);
  return { hours: Math.floor(t / 60), minutes: t % 60 };
}

function adjustDurationMinutes(current: string, deltaMinutes: number): string {
  const t = Number.parseInt(current, 10);
  const base = Number.isFinite(t) ? t : 0;
  const next = Math.max(0, Math.min(480, base + deltaMinutes));
  if (next <= 0) {
    return "0";
  }
  return String(normalizeDurationMinutes(next));
}

function formatMinutesAsHours(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (m === 0) {
    return "0 min";
  }
  if (h === 0) {
    return `${r} min`;
  }
  if (r === 0) {
    return `${h} hr${h === 1 ? "" : "s"}`;
  }
  return `${h} hrs ${r} min`;
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function createEmptyRow(): EntryRowState {
  return {
    clientId: crypto.randomUUID(),
    activityId: "",
    projectId: "",
    batteryId: "",
    stage: "RnD",
    lotId: "",
    durationMinutes: "0",
    batteries: [],
    lots: [],
  };
}

export function TimeEntryForm(): JSX.Element {
  const submitRef = useRef<HTMLButtonElement>(null);

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState<string | null>(null);

  const [deptId, setDeptId] = useState("");
  const [empId, setEmpId] = useState("");
  const [dateStr, setDateStr] = useState(todayLocalYmd);
  const [shiftId, setShiftId] = useState<number | "">("");
  const [shiftLocked, setShiftLocked] = useState(false);
  const [savedDayMinutes, setSavedDayMinutes] = useState(0);

  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  const [rows, setRows] = useState<EntryRowState[]>(() => [createEmptyRow()]);

  const [toast, setToast] = useState<string | null>(null);
  const [submitShaking, setSubmitShaking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadReference(): Promise<void> {
      const cached = readReferenceCache();
      if (cached) {
        setDepartments(cached.departments);
        setShifts(cached.shifts);
        setProjects(cached.projects);
        setRefLoading(false);
        return;
      }
      try {
        const [dRes, sRes, pRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/shifts"),
          fetch("/api/projects"),
        ]);
        if (!dRes.ok || !sRes.ok || !pRes.ok) {
          throw new Error("Failed to load reference data");
        }
        const dJson = (await dRes.json()) as { departments: DepartmentDto[] };
        const sJson = (await sRes.json()) as { shifts: ShiftDto[] };
        const pJson = (await pRes.json()) as { projects: ProjectDto[] };
        if (cancelled) {
          return;
        }
        setDepartments(dJson.departments);
        setShifts(sJson.shifts);
        setProjects(pJson.projects);
        writeReferenceCache({
          departments: dJson.departments,
          shifts: sJson.shifts,
          projects: pJson.projects,
        });
      } catch {
        if (!cancelled) {
          setRefError("Could not load form data. Refresh and try again.");
        }
      } finally {
        if (!cancelled) {
          setRefLoading(false);
        }
      }
    }
    void loadReference();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.empId === empId),
    [employees, empId],
  );

  const shiftNameForEmployee = useCallback(
    (emp: EmployeeDto): string =>
      shifts.find((s) => s.id === emp.shiftId)?.name ?? "—",
    [shifts],
  );

  const fetchSavedDayMinutes = useCallback(async (): Promise<void> => {
    if (!empId || !dateStr) {
      setSavedDayMinutes(0);
      return;
    }
    const params = new URLSearchParams({ empId, date: dateStr });
    const res = await fetch(`/api/entries/day-total?${params}`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { totalMinutes?: number };
    setSavedDayMinutes(data.totalMinutes ?? 0);
  }, [empId, dateStr]);

  useEffect(() => {
    void fetchSavedDayMinutes();
  }, [fetchSavedDayMinutes]);

  const fetchShiftState = useCallback(async (): Promise<void> => {
    if (!empId || !dateStr) {
      setShiftLocked(false);
      if (selectedEmployee) {
        setShiftId(selectedEmployee.shiftId);
      } else {
        setShiftId("");
      }
      return;
    }
    const params = new URLSearchParams({ empId, date: dateStr });
    const res = await fetch(`/api/entries/shift-check?${params}`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as ShiftCheckResponse;
    if (data.locked && data.shiftId !== undefined) {
      setShiftLocked(true);
      setShiftId(data.shiftId);
    } else {
      setShiftLocked(false);
      if (selectedEmployee) {
        setShiftId(selectedEmployee.shiftId);
      }
    }
  }, [empId, dateStr, selectedEmployee]);

  useEffect(() => {
    setShiftLocked(false);
  }, [empId]);

  useEffect(() => {
    void fetchShiftState();
  }, [fetchShiftState]);

  useEffect(() => {
    if (!deptId) {
      setEmployees([]);
      setActivities([]);
      setEmpId("");
      setRows([createEmptyRow()]);
      return;
    }
    let cancelled = false;
    setDeptLoading(true);
    const q = new URLSearchParams({ deptId });
    void Promise.all([
      fetch(`/api/employees?${q}`),
      fetch(`/api/activities?${q}`),
    ])
      .then(async ([eRes, aRes]) => {
        if (!eRes.ok || !aRes.ok) {
          throw new Error("Department data failed");
        }
        const eJson = (await eRes.json()) as { employees: EmployeeDto[] };
        const aJson = (await aRes.json()) as { activities: ActivityDto[] };
        if (cancelled) {
          return;
        }
        setEmployees(eJson.employees);
        setActivities(aJson.activities);
        setEmpId("");
        setRows([createEmptyRow()]);
      })
      .catch(() => {
        if (!cancelled) {
          setEmployees([]);
          setActivities([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDeptLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deptId]);

  useEffect(() => {
    if (!empId) {
      setShiftId("");
      setShiftLocked(false);
      return;
    }
    const emp = employees.find((e) => e.empId === empId);
    if (emp && !shiftLocked) {
      setShiftId(emp.shiftId);
    }
  }, [empId, employees, shiftLocked]);

  const totalMinutes = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const n = Number.parseInt(row.durationMinutes, 10);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [rows],
  );

  const combinedDayMinutes = savedDayMinutes + totalMinutes;
  const progressRatio = combinedDayMinutes / 480;
  const fillPercent = Math.min(100, progressRatio * 100);
  const overDailyCap = combinedDayMinutes > 480;

  const departmentOptions = useMemo(
    () =>
      departments.map((d) => ({
        value: String(d.id),
        label: `${d.name}`,
      })),
    [departments],
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((em) => ({
        value: em.empId,
        label: `${em.empCode} - ${em.firstName} ${em.lastName} (${shiftNameForEmployee(em)})`,
      })),
    [employees, shiftNameForEmployee],
  );

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: String(p.id),
        label: `${p.name}`,
      })),
    [projects],
  );

  const addRow = (): void => {
    const row = createEmptyRow();
    setRows((prev) => [...prev, row]);
  };

  const updateRow = (
    clientId: string,
    patch: Partial<EntryRowState>,
  ): void => {
    setRows((prev) =>
      prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (clientId: string): void => {
    setRows((prev) => {
      const next = prev.filter((r) => r.clientId !== clientId);
      return next.length === 0 ? [createEmptyRow()] : next;
    });
  };

  const setRowDurationTotal = (clientId: string, total: number): void => {
    const t = Math.max(0, Math.min(480, total));
    updateRow(clientId, { durationMinutes: t === 0 ? "0" : String(t) });
  };

  const onDurationHoursChange = (row: EntryRowState, raw: string): void => {
    const h = Math.min(8, Math.max(0, Number.parseInt(raw, 10) || 0));
    const base = Number.parseInt(row.durationMinutes, 10);
    const current = Number.isFinite(base) ? base : 0;
    const m = current % 60;
    setRowDurationTotal(row.clientId, h * 60 + m);
  };

  const onDurationMinutesChange = (row: EntryRowState, raw: string): void => {
    let mm = Number.parseInt(raw, 10);
    if (!Number.isFinite(mm)) {
      mm = 0;
    }
    mm = Math.min(59, Math.max(0, mm));
    const base = Number.parseInt(row.durationMinutes, 10);
    const current = Number.isFinite(base) ? base : 0;
    const h = Math.floor(current / 60);
    setRowDurationTotal(row.clientId, h * 60 + mm);
  };

  const onDurationFieldBlur = (row: EntryRowState): void => {
    const parsed = Number.parseInt(row.durationMinutes, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      updateRow(row.clientId, { durationMinutes: "0" });
      return;
    }
    updateRow(row.clientId, {
      durationMinutes: String(snapDurationMinutes(parsed)),
    });
  };

  const onProjectChange = async (
    row: EntryRowState,
    nextProjectId: string,
  ): Promise<void> => {
    if (!nextProjectId) {
      updateRow(row.clientId, {
        projectId: "",
        batteryId: "",
        lotId: "",
        batteries: [],
        lots: [],
      });
      return;
    }
    const res = await fetch(
      `/api/batteries?${new URLSearchParams({ projectId: nextProjectId })}`,
    );
    if (!res.ok) {
      return;
    }
    const json = (await res.json()) as { batteries: BatteryDto[] };
    updateRow(row.clientId, {
      projectId: nextProjectId,
      batteryId: "",
      lotId: "",
      batteries: json.batteries,
      lots: [],
    });
  };

  const onBatteryChange = async (
    row: EntryRowState,
    nextBatteryId: string,
  ): Promise<void> => {
    if (!nextBatteryId) {
      updateRow(row.clientId, {
        batteryId: "",
        lotId: "",
        lots: [],
      });
      return;
    }
    const res = await fetch(
      `/api/lots?${new URLSearchParams({ batteryId: nextBatteryId })}`,
    );
    if (!res.ok) {
      return;
    }
    const json = (await res.json()) as { lots: LotDto[] };
    updateRow(row.clientId, {
      batteryId: nextBatteryId,
      lotId: "",
      lots: json.lots,
    });
  };

  const triggerShake = (): void => {
    setSubmitShaking(true);
    window.setTimeout(() => setSubmitShaking(false), 350);
  };

  const validateRows = (): boolean => {
    for (const row of rows) {
      const dur = Number.parseInt(row.durationMinutes, 10);
      if (
        !row.activityId ||
        !row.projectId ||
        !row.batteryId ||
        !Number.isFinite(dur) ||
        dur <= 0
      ) {
        setSubmitError("Complete every entry row before submitting.");
        return false;
      }
      if (row.stage === "Production" && !row.lotId) {
        setSubmitError("Production rows require a lot.");
        return false;
      }
    }
    return true;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitError(null);
    if (rows.length === 0) {
      setSubmitError("Add at least one entry.");
      return;
    }
    if (savedDayMinutes + totalMinutes > 480) {
      triggerShake();
      submitRef.current?.focus();
      return;
    }
    if (
      !empId ||
      shiftId === "" ||
      !validateRows()
    ) {
      triggerShake();
      submitRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        employeeId: empId,
        entryDate: dateStr,
        shiftId: Number(shiftId),
        entries: rows.map((row) => ({
          activityId: Number(row.activityId),
          projectId: Number(row.projectId),
          batteryId: Number(row.batteryId),
          lotId: row.stage === "Production" ? Number(row.lotId) : null,
          stage: row.stage,
          durationMinutes: Number(row.durationMinutes),
        })),
      };
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSubmitError(json.error ?? "Submit failed.");
        triggerShake();
        submitRef.current?.focus();
        return;
      }
      setRows([createEmptyRow()]);
      setToast("Time entries saved.");
      window.setTimeout(() => setToast(null), 3000);
      await Promise.all([fetchShiftState(), fetchSavedDayMinutes()]);
    } finally {
      setSubmitting(false);
    }
  };

  if (refLoading) {
    return <TimeEntryFormSkeleton />;
  }

  if (refError) {
    return (
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <p className="text-sm text-danger">{refError}</p>
      </section>
    );
  }

  return (
    <>
      {toast ? (
        <div
          className="fixed right-4 top-4 z-50 animate-toast-in rounded-input border border-success/30 bg-success-light px-4 py-3 text-sm font-medium text-success shadow-card"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <form
        className="space-y-6"
        onSubmit={(e) => void onSubmit(e)}
      >
        <header className="rounded-card border border-border bg-surface p-6 shadow-card">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
            Log Time
          </p>
          <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-text-primary">
            Time entry
          </h1>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SearchableSelect
              id="dept"
              label="Department"
              placeholder="Search departments…"
              options={departmentOptions}
              value={deptId}
              onValueChange={setDeptId}
              disabled={deptLoading}
              emptyLabel="No departments"
            />

            <SearchableSelect
              id="emp"
              label="Employee"
              placeholder="Search employees…"
              options={employeeOptions}
              value={empId}
              onValueChange={setEmpId}
              disabled={!deptId || deptLoading}
              emptyLabel="No employees in this department"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-primary" htmlFor="entry-date">
                Date
              </label>
              <input
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                id="entry-date"
                type="date"
                max={todayLocalYmd()}
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-text-primary">Time logged</span>
              <div
                className={`mt-1 h-2 w-full overflow-hidden rounded bg-border ${
                  overDailyCap ? "ring-2 ring-danger ring-offset-2 ring-offset-surface" : ""
                }`}
                role="progressbar"
                aria-valuenow={combinedDayMinutes}
                aria-valuemin={0}
                aria-valuemax={480}
                aria-label="Time logged today: saved entries plus this form, out of 8 hours"
              >
                <div
                  className="flex h-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${fillPercent}%`,
                  }}
                >
                  {combinedDayMinutes > 0 ? (
                    <>
                      {savedDayMinutes > 0 ? (
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(savedDayMinutes / combinedDayMinutes) * 100}%`,
                          }}
                          title="Previously saved today"
                        />
                      ) : null}
                      {totalMinutes > 0 ? (
                        <div
                          className="h-full bg-accent"
                          style={{
                            width: `${(totalMinutes / combinedDayMinutes) * 100}%`,
                          }}
                          title="This form (not yet submitted)"
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-sm text-text-primary">
                    {formatMinutesAsHours(combinedDayMinutes)} / 8 hrs
                  </span>
                  {combinedDayMinutes > 0 ? (
                    <span className="text-xs text-text-secondary">
                      {savedDayMinutes > 0 ? (
                        <span>
                          <span className="font-medium text-primary">Saved</span>{" "}
                          {formatMinutesAsHours(savedDayMinutes)}
                        </span>
                      ) : null}
                      {savedDayMinutes > 0 && totalMinutes > 0 ? " · " : null}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-4">
          {rows.map((row) => {
            const dh = splitDuration(row.durationMinutes);
            const activityOptions = activities.map((a) => ({
              value: String(a.id),
              label: a.name,
            }));
            const batteryOptions = row.batteries.map((b) => ({
              value: String(b.id),
              label: b.modelName,
            }));
            const lotOptions =
              row.stage === "Production"
                ? row.lots.map((lot) => ({
                    value: String(lot.id),
                    label: lot.lotNumber,
                  }))
                : [];

            return (
              <div
                key={row.clientId}
                className="animate-row-enter rounded-card border border-border bg-surface p-5 shadow-card"
              >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <SearchableSelect
                    id={`activity-${row.clientId}`}
                    label="Activity"
                    placeholder="Search activities…"
                    options={activityOptions}
                    value={row.activityId}
                    onValueChange={(v) =>
                      updateRow(row.clientId, { activityId: v })
                    }
                    disabled={!deptId}
                    emptyLabel="No activities"
                  />

                  <SearchableSelect
                    id={`project-${row.clientId}`}
                    label="Project"
                    placeholder="Search projects…"
                    options={projectOptions}
                    value={row.projectId}
                    onValueChange={(v) => void onProjectChange(row, v)}
                    emptyLabel="No projects"
                  />

                  <SearchableSelect
                    id={`battery-${row.clientId}`}
                    label="Battery model"
                    placeholder="Search batteries…"
                    options={batteryOptions}
                    value={row.batteryId}
                    onValueChange={(v) => void onBatteryChange(row, v)}
                    disabled={!row.projectId}
                    emptyLabel={
                      row.projectId ? "No batteries for project" : "Pick a project first"
                    }
                  />

                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-sm text-text-primary"
                      htmlFor={`stage-${row.clientId}`}
                    >
                      Stage
                    </label>
                    <select
                      className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                      id={`stage-${row.clientId}`}
                      value={row.stage}
                      onChange={(e) => {
                        const next = e.target.value as "RnD" | "Production";
                        updateRow(row.clientId, {
                          stage: next,
                          ...(next === "RnD" ? { lotId: "" } : {}),
                        });
                      }}
                    >
                      <option value="RnD">R&amp;D</option>
                      <option value="Production">Production</option>
                    </select>
                  </div>

                  <SearchableSelect
                    id={`lot-${row.clientId}`}
                    label="Lot"
                    placeholder="Search lots…"
                    options={lotOptions}
                    value={row.lotId}
                    onValueChange={(v) => updateRow(row.clientId, { lotId: v })}
                    disabled={row.stage === "RnD" || !row.batteryId}
                    emptyLabel={
                      row.stage === "RnD"
                        ? "Not used for R&D"
                        : row.batteryId
                          ? "No lots for this battery"
                          : "Select a battery first"
                    }
                  />

                  <div className="flex flex-col gap-1.5 lg:col-span-2 xl:col-span-1">
                    <span className="text-sm text-text-primary">Duration</span>
                    <div className="flex flex-wrap items-end gap-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-text-secondary">Hours</span>
                        <div className="flex items-center gap-2">
                          <button
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border bg-surface text-lg leading-none text-text-primary transition-colors hover:bg-appbg active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
                            type="button"
                            aria-label="Decrease hours"
                            onClick={() =>
                              updateRow(row.clientId, {
                                durationMinutes: adjustDurationMinutes(
                                  row.durationMinutes,
                                  -60,
                                ),
                              })
                            }
                          >
                            −
                          </button>
                          <input
                            className="min-w-[3rem] max-w-[4rem] rounded-input border border-border bg-surface px-2 py-1.5 text-center font-mono text-sm tabular-nums text-text-primary hover:border-[#9aaec1] focus-visible:border-primary focus-visible:outline-none"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={8}
                            aria-label="Hours"
                            value={dh.hours}
                            onChange={(e) =>
                              onDurationHoursChange(row, e.target.value)
                            }
                            onBlur={() => onDurationFieldBlur(row)}
                          />
                          <button
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border bg-surface text-lg leading-none text-text-primary transition-colors hover:bg-appbg active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
                            type="button"
                            aria-label="Increase hours"
                            onClick={() =>
                              updateRow(row.clientId, {
                                durationMinutes: adjustDurationMinutes(
                                  row.durationMinutes,
                                  60,
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-text-secondary">
                          Minutes
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border bg-surface text-lg leading-none text-text-primary transition-colors hover:bg-appbg active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
                            type="button"
                            aria-label="Decrease minutes"
                            onClick={() =>
                              updateRow(row.clientId, {
                                durationMinutes: adjustDurationMinutes(
                                  row.durationMinutes,
                                  -15,
                                ),
                              })
                            }
                          >
                            −
                          </button>
                          <input
                            className="min-w-[3rem] max-w-[4rem] rounded-input border border-border bg-surface px-2 py-1.5 text-center font-mono text-sm tabular-nums text-text-primary hover:border-[#9aaec1] focus-visible:border-primary focus-visible:outline-none"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={59}
                            step={1}
                            aria-label="Minutes"
                            value={dh.minutes}
                            onChange={(e) =>
                              onDurationMinutesChange(row, e.target.value)
                            }
                            onBlur={() => onDurationFieldBlur(row)}
                          />
                          <button
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border bg-surface text-lg leading-none text-text-primary transition-colors hover:bg-appbg active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
                            type="button"
                            aria-label="Increase minutes"
                            onClick={() =>
                              updateRow(row.clientId, {
                                durationMinutes: adjustDurationMinutes(
                                  row.durationMinutes,
                                  15,
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    className="rounded-input border border-danger/40 bg-danger-light px-4 py-2 text-sm font-medium text-danger hover:opacity-90 active:scale-[0.97]"
                    type="button"
                    onClick={() => removeRow(row.clientId)}
                  >
                    Remove entry
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <button
              className="rounded-input border border-border bg-transparent px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-appbg active:scale-[0.97] md:w-auto"
              type="button"
              onClick={addRow}
            >
              Add another Time Log Entry
            </button>

            <button
              ref={submitRef}
              className={`rounded-input bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                submitShaking ? "animate-shake border-2 border-danger" : ""
              }`}
              type="submit"
              disabled={
                submitting || rows.length === 0 || !empId || shiftId === ""
              }
            >
              {submitting ? "Submitting…" : "Submit All"}
            </button>
          </div>

          {submitError ? (
            <p className="text-sm text-danger" role="alert">
              {submitError}
            </p>
          ) : null}
        </div>
      </form>
    </>
  );
}
