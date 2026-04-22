export const PROJECT_COLORS: Record<string, { hex: string; name: string }> = {
  navy: { hex: "#1B3A5C", name: "Navy" },
  teal: { hex: "#0F6E56", name: "Teal" },
  amber: { hex: "#E8A020", name: "Amber" },
  coral: { hex: "#C0392B", name: "Coral" },
  violet: { hex: "#6C3483", name: "Violet" },
  slate: { hex: "#2E86C1", name: "Slate" },
  forest: { hex: "#1E8449", name: "Forest" },
  rose: { hex: "#C0395B", name: "Rose" },
  ochre: { hex: "#B7770D", name: "Ochre" },
  indigo: { hex: "#3B3F8C", name: "Indigo" },
  pine: { hex: "#1A5C4A", name: "Pine" },
  sienna: { hex: "#A04000", name: "Sienna" },
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
