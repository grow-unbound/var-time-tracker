import { z } from "zod";

export const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd");

export const deptIdQuerySchema = z.object({
  deptId: z.coerce.number().int().positive(),
});

export const projectIdQuerySchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

/** When `projectId` is omitted, callers may list all batteries for active projects. */
export const batteriesQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
});

export const batteryIdQuerySchema = z.object({
  batteryId: z.coerce.number().int().positive(),
});

export const shiftCheckQuerySchema = z.object({
  empId: z.string().min(1),
  date: dateYmdSchema,
});

export const timeEntryStageSchema = z.enum(["RnD", "Production"]);

export const postEntryRowSchema = z.object({
  activityId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  batteryId: z.number().int().positive(),
  lotId: z.number().int().positive().nullable(),
  stage: timeEntryStageSchema,
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(480)
    .refine((n) => n % 15 === 0, "durationMinutes must be a multiple of 15"),
});

export const postEntriesBodySchema = z.object({
  employeeId: z.string().min(1),
  entryDate: dateYmdSchema,
  shiftId: z.number().int().positive(),
  entries: z.array(postEntryRowSchema).min(1),
});

export const entriesListSortFieldSchema = z.enum([
  "date",
  "employee",
  "department",
  "project",
  "battery",
  "lot",
  "stage",
  "activity",
  "duration",
]);

export const commaSeparatedPositiveIdsSchema = z
  .string()
  .optional()
  .transform((s) => {
    if (!s?.trim()) return undefined;
    const ids = Array.from(
      new Set(
        s
          .split(",")
          .map((x) => Number(x.trim()))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    );
    return ids.length > 0 ? ids.slice(0, 100) : undefined;
  });

export const shiftBoardQuerySchema = z.object({
  date: dateYmdSchema,
  shift: z.coerce.number().int().positive(),
  depts: commaSeparatedPositiveIdsSchema,
  projects: commaSeparatedPositiveIdsSchema,
});

export const shiftBoardPersonQuerySchema = z.object({
  date: dateYmdSchema,
  shift: z.coerce.number().int().positive(),
  depts: commaSeparatedPositiveIdsSchema,
});

const durationHoursSchema = z
  .number()
  .min(0.25)
  .max(8)
  .refine(
    (n) => {
      const scaled = Math.round(n * 100);
      return scaled % 25 === 0;
    },
    { message: "duration must represent 15-minute steps (0.25h increments)" },
  );

export const postShiftAssignmentBodySchema = z.object({
  emp_id: z.string().min(1),
  sub_project_id: z.number().int().positive(),
  activity_id: z.number().int().positive(),
  shift_date: dateYmdSchema,
  shift_id: z.number().int().positive(),
  duration_hours: durationHoursSchema,
});

/** Matches `TimeScope` in lib/dashboard-date-range.ts */
export const entriesListTimeScopeSchema = z.enum([
  "all",
  "today",
  "yesterday",
  "week",
  "month",
  "year",
]);

export const entriesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t && t.length > 0 ? t : undefined;
    }),
  sortBy: entriesListSortFieldSchema.optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  scope: z.preprocess(
    (raw) => (raw === undefined || raw === "" ? "all" : raw),
    entriesListTimeScopeSchema,
  ),
  depts: commaSeparatedPositiveIdsSchema,
  projects: commaSeparatedPositiveIdsSchema,
  batteries: commaSeparatedPositiveIdsSchema,
});

export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; message: string } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, message };
  }
  return { ok: true, data: parsed.data };
}

export function parseSearchParams<T>(
  schema: z.ZodType<T>,
  searchParams: URLSearchParams,
): { ok: true; data: T } | { ok: false; message: string } {
  const record: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    record[key] = value;
  });
  const parsed = schema.safeParse(record);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, message };
  }
  return { ok: true, data: parsed.data };
}
