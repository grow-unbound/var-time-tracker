import { z } from "zod";

import { dateYmdSchema } from "@/lib/api-validation";

export const subProjectStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "on_hold",
]);

export const patchSubProjectBodySchema = z.object({
  status: subProjectStatusSchema.optional(),
  plannedStart: z.union([dateYmdSchema, z.null()]).optional(),
  plannedEnd: z.union([dateYmdSchema, z.null()]).optional(),
  predecessorSubProjectId: z.union([z.number().int().positive(), z.null()]).optional(),
});

export const postProjectBodySchema = z.object({
  name: z.string().min(1).max(200),
  projectCode: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, "projectCode: letters, numbers, underscore, hyphen only"),
  description: z.string().max(2000).optional(),
  plannedStart: dateYmdSchema.optional(),
  plannedEnd: dateYmdSchema.optional(),
});

export const postMilestoneBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    targetDate: dateYmdSchema,
    projectId: z.number().int().positive().nullable(),
    subProjectId: z.number().int().positive().nullable(),
    status: z.enum(["pending", "achieved", "missed"]).optional(),
  })
  .refine(
    (b) =>
      (b.projectId == null) !== (b.subProjectId == null) &&
      (b.projectId != null || b.subProjectId != null),
    { message: "Exactly one of projectId or subProjectId must be set" },
  );

export const patchMilestoneBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  targetDate: dateYmdSchema.optional(),
  status: z.enum(["pending", "achieved", "missed"]).optional(),
});
