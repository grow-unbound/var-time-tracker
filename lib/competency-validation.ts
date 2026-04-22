import { z } from "zod";

import { commaSeparatedPositiveIdsSchema, dateYmdSchema } from "@/lib/api-validation";

import type { CompetencyStatusToken } from "@/lib/competency-types";

const competencyStatusTokenSchema = z.enum(["active", "expired", "expiring"]);

export const competencyStatusesQuerySchema = z.preprocess(
  (raw) => (raw === undefined || raw === "" ? "" : String(raw)),
  z.string(),
).transform((raw): CompetencyStatusToken[] => {
  if (!raw.trim()) {
    return [];
  }
  const seen = new Set<CompetencyStatusToken>();
  const out: CompetencyStatusToken[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    const parsed = competencyStatusTokenSchema.safeParse(t);
    if (parsed.success && !seen.has(parsed.data)) {
      seen.add(parsed.data);
      out.push(parsed.data);
    }
  }
  return out;
});

export const competencyMatrixQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  depts: commaSeparatedPositiveIdsSchema,
  activities: commaSeparatedPositiveIdsSchema,
  shifts: commaSeparatedPositiveIdsSchema,
  statuses: competencyStatusesQuerySchema,
  q: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t && t.length > 0 ? t : undefined;
    }),
});

export const postCompetencyBodySchema = z.object({
  emp_id: z.string().min(1),
  activity_id: z.number().int().positive(),
  level: z.union([z.literal(0), z.literal(1)]),
  active_date: dateYmdSchema,
  expiry_date: z
    .union([dateYmdSchema, z.literal(""), z.null()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined) {
        return null;
      }
      return v;
    }),
});

export type CompetencyMatrixQuery = z.infer<typeof competencyMatrixQuerySchema>;
export type PostCompetencyBody = z.infer<typeof postCompetencyBodySchema>;
