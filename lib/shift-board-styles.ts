/** Stable tints for matrix chips (dept). Replace with DB-backed colours later if needed. */
const DEPT_CHIP_PALETTE: { bg: string; text: string }[] = [
  { bg: "rgba(27, 58, 92, 0.12)", text: "#1B3A5C" },
  { bg: "rgba(232, 160, 32, 0.2)", text: "#7A4E00" },
  { bg: "rgba(15, 110, 86, 0.15)", text: "#0F6E56" },
  { bg: "rgba(44, 134, 193, 0.15)", text: "#1E5A85" },
  { bg: "rgba(108, 52, 131, 0.12)", text: "#4A1F5C" },
  { bg: "rgba(192, 57, 43, 0.1)", text: "#7B241C" },
];

export function getDepartmentChipStyle(departmentId: number): {
  backgroundColor: string;
  color: string;
} {
  const i = Math.abs(departmentId) % DEPT_CHIP_PALETTE.length;
  const c = DEPT_CHIP_PALETTE[i]!;
  return { backgroundColor: c.bg, color: c.text };
}
