import type { DashboardStage } from "@/lib/dashboard-types";

function parseHexRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) {
    return null;
  }
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) {
    return null;
  }
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mixChannel(a: number, b: number, t: number): number {
  return clamp255(a + (b - a) * t);
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    mixChannel(a[0], b[0], t),
    mixChannel(a[1], b[1], t),
    mixChannel(a[2], b[2], t),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  const [r, g, b] = rgb;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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

/**
 * Stacked bar segment color: each row is a project — tint that project's palette
 * hex by stage (R&D lighter, production deeper) and nudge by battery index so
 * adjacent stacks remain distinguishable.
 */
export function projectBatteryStageBarColor(
  projectBaseHex: string | undefined,
  batteryIndex: number,
  stage: DashboardStage,
): string {
  const rgb = projectBaseHex ? parseHexRgb(projectBaseHex) : null;
  if (!rgb) {
    return batteryStageColor(batteryIndex, stage);
  }
  const drift = (batteryIndex % 4) * 0.035;
  const white: [number, number, number] = [255, 255, 255];
  const deep: [number, number, number] = [28, 28, 42];
  if (stage === "RnD") {
    const t = Math.min(0.52, 0.34 + drift);
    return rgbToHex(mixRgb(rgb, white, t));
  }
  const t = Math.min(0.42, 0.16 + drift * 0.6);
  return rgbToHex(mixRgb(rgb, deep, t));
}

export function stageLabel(stage: DashboardStage): string {
  return stage === "RnD" ? "R&D" : "Production";
}

/** Secondary chart: R&D / production bars (toned between original and over-light pass). */
export const STAGE_COLORS = {
  rnd: "#5B6F86",
  production: "#D4A348",
} as const;
