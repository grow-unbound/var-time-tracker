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
