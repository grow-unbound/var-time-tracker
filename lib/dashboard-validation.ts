import { z } from "zod";

import type { TimeScope } from "@/lib/dashboard-date-range";

function parseCommaSeparatedInts(raw: unknown): number[] {
  if (raw === undefined || raw === "") {
    return [];
  }
  const s = String(raw).trim();
  if (s === "") {
    return [];
  }
  return s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number.parseInt(p, 10));
}

const commaIntsSchema = z.preprocess(
  (raw) => parseCommaSeparatedInts(raw),
  z.array(
    z.number().int().positive({
      message: "Expected comma-separated positive integers",
    }),
  ),
);

export const dashboardQuerySchema = z.object({
  scope: z.preprocess(
    (raw) => (raw === undefined || raw === "" ? "week" : raw),
    z.enum(["all", "today", "yesterday", "week", "month", "year"]),
  ).transform((s) => s as TimeScope),
  depts: commaIntsSchema,
  projects: commaIntsSchema,
  batteries: commaIntsSchema,
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
