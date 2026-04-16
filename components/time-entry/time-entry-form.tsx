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

const DURATION_OPTIONS = Array.from(
  { length: 32 },
  (_, i) => String((i + 1) * 15),
);

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
    durationMinutes: "60",
    batteries: [],
    lots: [],
  };
}

export function TimeEntryForm(): JSX.Element {
  const activityRefs = useRef<Map<string, HTMLSelectElement>>(new Map());
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

  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  const [rows, setRows] = useState<EntryRowState[]>([]);

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
      setRows([]);
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
        setRows([]);
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

  const progressRatio = totalMinutes / 480;
  const fillPercent = Math.min(100, progressRatio * 100);
  let fillClass = "bg-primary";
  if (progressRatio >= 1) {
    fillClass = "bg-danger";
  } else if (progressRatio > 0.75) {
    fillClass = "bg-accent";
  }

  const remaining = Math.max(0, 480 - totalMinutes);
  const remainingLabel =
    totalMinutes >= 480
      ? "0 min remaining — limit reached"
      : `${remaining} min remaining`;

  const addRow = (): void => {
    const row = createEmptyRow();
    setRows((prev) => [...prev, row]);
    requestAnimationFrame(() => {
      activityRefs.current.get(row.clientId)?.focus();
    });
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
    setRows((prev) => prev.filter((r) => r.clientId !== clientId));
    activityRefs.current.delete(clientId);
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
      if (
        !row.activityId ||
        !row.projectId ||
        !row.batteryId ||
        !row.durationMinutes
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
    if (totalMinutes > 480) {
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
      setRows([]);
      setToast("Time entries saved.");
      window.setTimeout(() => setToast(null), 3000);
      await fetchShiftState();
    } finally {
      setSubmitting(false);
    }
  };

  if (refLoading) {
    return (
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <p className="text-sm text-text-secondary">Loading form…</p>
      </section>
    );
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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-primary" htmlFor="dept">
                Department
              </label>
              <select
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                id="dept"
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                disabled={deptLoading}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-primary" htmlFor="emp">
                Employee
              </label>
              <select
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                id="emp"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                disabled={!deptId || deptLoading}
              >
                <option value="">Select employee</option>
                {employees.map((em) => (
                  <option key={em.empId} value={em.empId}>
                    {em.empId} — {em.firstName} {em.lastName}
                  </option>
                ))}
              </select>
            </div>

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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-primary" htmlFor="shift">
                Shift
              </label>
              <select
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                id="shift"
                value={shiftId === "" ? "" : String(shiftId)}
                onChange={(e) =>
                  setShiftId(e.target.value ? Number(e.target.value) : "")
                }
                disabled={!empId || shiftLocked}
              >
                <option value="">Select shift</option>
                {shifts.map((s) => {
                  const empShift = selectedEmployee?.shiftId;
                  const optionLocked =
                    !shiftLocked &&
                    empShift !== undefined &&
                    s.id !== empShift;
                  return (
                    <option key={s.id} value={s.id} disabled={optionLocked}>
                      {s.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </header>

        <button
          className="rounded-input border border-border bg-transparent px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-appbg active:scale-[0.97] md:w-auto"
          type="button"
          onClick={addRow}
        >
          Add Entry
        </button>

        <div className="space-y-4">
          {rows.map((row) => (
            <div
              key={row.clientId}
              className="animate-row-enter rounded-card border border-border bg-surface p-5 shadow-card"
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm text-text-primary"
                    htmlFor={`activity-${row.clientId}`}
                  >
                    Activity
                  </label>
                  <select
                    ref={(el) => {
                      if (el) {
                        activityRefs.current.set(row.clientId, el);
                      } else {
                        activityRefs.current.delete(row.clientId);
                      }
                    }}
                    className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                    id={`activity-${row.clientId}`}
                    value={row.activityId}
                    onChange={(e) =>
                      updateRow(row.clientId, { activityId: e.target.value })
                    }
                    disabled={!deptId}
                  >
                    <option value="">Select activity</option>
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm text-text-primary"
                    htmlFor={`project-${row.clientId}`}
                  >
                    Project
                  </label>
                  <select
                    className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                    id={`project-${row.clientId}`}
                    value={row.projectId}
                    onChange={(e) => void onProjectChange(row, e.target.value)}
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm text-text-primary"
                    htmlFor={`battery-${row.clientId}`}
                  >
                    Battery model
                  </label>
                  <select
                    className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                    id={`battery-${row.clientId}`}
                    value={row.batteryId}
                    onChange={(e) => void onBatteryChange(row, e.target.value)}
                    disabled={!row.projectId}
                  >
                    <option value="">Select battery</option>
                    {row.batteries.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.modelName}
                      </option>
                    ))}
                  </select>
                </div>

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
                        ...(next === "RnD"
                          ? { lotId: "", lots: [] }
                          : {}),
                      });
                    }}
                  >
                    <option value="RnD">R&amp;D</option>
                    <option value="Production">Production</option>
                  </select>
                </div>

                {row.stage === "Production" ? (
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-sm text-text-primary"
                      htmlFor={`lot-${row.clientId}`}
                    >
                      Lot
                    </label>
                    <select
                      className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                      id={`lot-${row.clientId}`}
                      value={row.lotId}
                      onChange={(e) =>
                        updateRow(row.clientId, { lotId: e.target.value })
                      }
                      disabled={!row.batteryId}
                    >
                      <option value="">Select lot</option>
                      {row.lots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.lotNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-sm text-text-primary"
                    htmlFor={`duration-${row.clientId}`}
                  >
                    Duration (minutes)
                  </label>
                  <select
                    className="rounded-input border border-border bg-surface px-3 py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary"
                    id={`duration-${row.clientId}`}
                    value={row.durationMinutes}
                    onChange={(e) =>
                      updateRow(row.clientId, {
                        durationMinutes: e.target.value,
                      })
                    }
                  >
                    {DURATION_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  className="rounded-input border border-danger/40 bg-danger-light px-4 py-2 text-sm font-medium text-danger hover:opacity-90 active:scale-[0.97]"
                  type="button"
                  onClick={() => removeRow(row.clientId)}
                >
                  Remove row
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-text-primary">
              Shift time used
            </span>
            <span className="font-mono text-sm text-text-secondary">
              {totalMinutes} / 480 min
            </span>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded bg-border"
            role="progressbar"
            aria-valuenow={totalMinutes}
            aria-valuemin={0}
            aria-valuemax={480}
            aria-label="Minutes used out of 480"
          >
            <div
              className={`h-full rounded transition-[width] duration-300 ease-out ${fillClass}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-text-secondary">{remainingLabel}</p>
        </div>

        {submitError ? (
          <p className="text-sm text-danger" role="alert">
            {submitError}
          </p>
        ) : null}

        <button
          ref={submitRef}
          className={`rounded-input bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
            submitShaking ? "animate-shake border-2 border-danger" : ""
          }`}
          type="submit"
          disabled={submitting || rows.length === 0 || !empId || shiftId === ""}
        >
          {submitting ? "Submitting…" : "Submit All"}
        </button>
      </form>
    </>
  );
}
