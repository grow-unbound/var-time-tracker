import type { DashboardStage } from "@/lib/dashboard-types";

/** Lighter = R&D, darker = Production per architecture spec. */
export function batteryStageColor(
  batteryIndex: number,
  stage: DashboardStage,
): string {
  const hue = (batteryIndex * 47) % 360;
  if (stage === "RnD") {
    return `hsl(${hue} 36% 68%)`;
  }
  return `hsl(${hue} 44% 56%)`;
}

export function stageLabel(stage: DashboardStage): string {
  return stage === "RnD" ? "R&D" : "Production";
}

/** Secondary chart: R&D / production bars (toned between original and over-light pass). */
export const STAGE_COLORS = {
  rnd: "#5B6F86",
  production: "#D4A348",
} as const;
