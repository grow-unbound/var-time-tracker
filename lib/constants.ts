/**
 * 12 distinct categorical colors (revised v2 addendum) for clear separation
 * in Gantt bars, boards, and charts — avoid near-duplicates (e.g. old coral vs rose).
 */
export const PROJECT_COLORS: Record<string, { hex: string; name: string }> = {
  navy: { hex: "#1E3A5F", name: "Navy" },
  teal: { hex: "#14B8A6", name: "Teal" },
  amber: { hex: "#F59E0B", name: "Amber" },
  coral: { hex: "#FB923C", name: "Coral" },
  violet: { hex: "#A855F7", name: "Violet" },
  slate: { hex: "#64748B", name: "Slate" },
  forest: { hex: "#22C55E", name: "Forest" },
  rose: { hex: "#F43F5E", name: "Rose" },
  ochre: { hex: "#CA8A04", name: "Ochre" },
  indigo: { hex: "#4F46E5", name: "Indigo" },
  pine: { hex: "#15803D", name: "Pine" },
  sienna: { hex: "#C2410C", name: "Sienna" },
};

export const PROJECT_COLOR_KEYS = Object.keys(PROJECT_COLORS) as string[];

export const DEFAULT_PROJECT_COLOR = "navy";

export function getProjectColor(key: string): string {
  const entry = PROJECT_COLORS[key];
  return entry?.hex ?? PROJECT_COLORS[DEFAULT_PROJECT_COLOR]!.hex;
}

/** First palette key not present in `used` (active projects); falls back to default. */
export function pickNextProjectColorKey(used: string[]): string {
  const set = new Set(used);
  for (const k of PROJECT_COLOR_KEYS) {
    if (!set.has(k)) {
      return k;
    }
  }
  return DEFAULT_PROJECT_COLOR;
}
