/** Unified row height (44px) for shift board: matches Tailwind `h-11` / `min-h-11`. */
export const SHIFT_BOARD_ROW_PX = 44;

export const shiftBoardTableHeaderClass =
  "box-border flex h-11 min-h-11 shrink-0 items-center border-b border-border py-0 pl-3 pr-2 text-left text-[11px] font-medium uppercase leading-none tracking-wide text-text-secondary";

export const shiftBoardGroupRowClass =
  "box-border flex h-11 min-h-11 items-center border-b border-border bg-surface/80 px-2";

export const shiftBoardDataRowClass =
  "box-border flex h-11 min-h-11 items-center gap-2 border-b border-border pl-1 pr-2 text-sm leading-5 text-text-primary";

export const shiftBoardEmptySearchRowClass =
  "box-border flex h-11 min-h-11 items-center border-b border-border px-3 pl-1 pr-2 text-sm leading-5 text-text-secondary";

export const shiftBoardProjectHeaderCellClass =
  "box-border flex h-11 min-h-11 w-full min-h-0 items-center justify-center border-l border-border/50 px-1.5 text-center text-[11px] font-medium leading-tight text-text-secondary";

export const shiftBoardHrsHeaderClass =
  "box-border flex h-11 min-h-11 w-full items-center justify-center border-b border-border px-1.5 text-center text-[11px] font-medium uppercase leading-none tracking-wide text-text-secondary";

export const shiftBoardHrsDataCellClass =
  "box-border flex h-11 min-h-11 w-full min-h-0 items-center justify-center border-b border-border px-1.5 text-center font-mono text-sm leading-5 text-text-primary";

/** Person view: second sticky column (hours) — set `style.left` to employee column width. */
export const shiftBoardPersonHrsStickyClass =
  "sticky z-[34] box-border w-[100px] shrink-0 border-r border-border bg-surface";

export const shiftBoardProjectGridRowClass = "min-h-11 border-b border-border";

/** Min height for Matrix/Person *activity* data rows: ~3–4 stacked chips + add affordance. */
export const SHIFT_BOARD_MATRIX_DATA_ROW_MIN_PX = 180;

/** Must match {@link SHIFT_BOARD_MATRIX_DATA_ROW_MIN_PX} for Tailwind purge. */
export const shiftBoardMatrixDataRowMinClass = "min-h-[180px]";

/** Sticky first column (dept / activity / empty state) in unified matrix grid. */
export const shiftBoardMatrixStickyFirstColClass =
  "sticky left-0 z-30 box-border border-r border-border bg-surface";

/** Matrix / Person project cell: fixed min height, vertical stack, hover-reveal add. */
export const shiftBoardMatrixProjectCellGroupClass =
  "group relative box-border flex h-full min-h-0 w-full min-w-0 flex-col border-b border-l border-border/30";

/** Scrollable chip list inside a matrix cell (5+ chips). */
export const shiftBoardMatrixChipListClass =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5";

/** Add strip: hidden until hover/focus; always visible on small screens. */
export const shiftBoardMatrixAddStripClass =
  "pointer-events-auto flex h-7 w-full shrink-0 items-center justify-center border-t border-border/30 text-xs font-medium text-primary opacity-0 transition-opacity hover:bg-black/[0.04] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-md:opacity-100";

/** Person view: vertical padding in chip list (`p-1.5`). */
const PERSON_CELL_PAD_PX = 12;
/** Person view: estimated chip row height (11px leading-snug + py-1). */
const PERSON_CHIP_ROW_PX = 32;
const PERSON_CHIP_GAP_PX = 4;
const PERSON_ADD_STRIP_PX = 28;
/** Empty cell with “add” CTA — enough for tap target + label on hover. */
const PERSON_EMPTY_ADDABLE_MIN_PX = 88;
/** Empty cell when total hours are capped — still align with a readable name cell. */
const PERSON_EMPTY_BLOCKED_MIN_PX = 64;

/**
 * Minimum height for one Person-view project column, given assignment count.
 * Rows use the max of this across all project columns for the employee. Capped at
 * {@link SHIFT_BOARD_MATRIX_DATA_ROW_MIN_PX} so extra assignments scroll inside the chip list.
 */
export function shiftBoardPersonColumnMinHeightPx(
  assignmentCount: number,
  canAddMore: boolean,
): number {
  if (assignmentCount === 0) {
    return canAddMore ? PERSON_EMPTY_ADDABLE_MIN_PX : PERSON_EMPTY_BLOCKED_MIN_PX;
  }
  const stack =
    PERSON_CELL_PAD_PX +
    assignmentCount * PERSON_CHIP_ROW_PX +
    Math.max(0, assignmentCount - 1) * PERSON_CHIP_GAP_PX;
  const withAdd = canAddMore ? stack + PERSON_ADD_STRIP_PX : stack;
  return Math.min(SHIFT_BOARD_MATRIX_DATA_ROW_MIN_PX, Math.max(72, withAdd));
}

/** Min height for a Person-view employee row (all cells in that grid row). */
export function shiftBoardPersonRowMinHeightPx(
  perColumnAssignmentCounts: number[],
  canAddMore: boolean,
): number {
  let m = 0;
  for (const n of perColumnAssignmentCounts) {
    m = Math.max(m, shiftBoardPersonColumnMinHeightPx(n, canAddMore));
  }
  return m;
}

/**
 * Matrix: one project cell’s minimum height. If there is no sub-project for the cell, only
 * a placeholder is shown. Otherwise uses the same stacking math as
 * {@link shiftBoardPersonColumnMinHeightPx} (add strip when there is a sub to assign into).
 */
export function shiftBoardMatrixColumnMinHeightPx(
  assignmentCount: number,
  subProjectId: number | null,
): number {
  if (subProjectId == null) {
    return PERSON_EMPTY_BLOCKED_MIN_PX;
  }
  if (assignmentCount === 0) {
    return PERSON_EMPTY_ADDABLE_MIN_PX;
  }
  return shiftBoardPersonColumnMinHeightPx(assignmentCount, true);
}

/** Matrix: one activity row — max of all project column minimums. */
export function shiftBoardMatrixRowMinHeightPx(
  perColumn: { assignmentCount: number; subProjectId: number | null }[],
): number {
  let m = 0;
  for (const c of perColumn) {
    m = Math.max(
      m,
      shiftBoardMatrixColumnMinHeightPx(
        c.assignmentCount,
        c.subProjectId,
      ),
    );
  }
  return m;
}
