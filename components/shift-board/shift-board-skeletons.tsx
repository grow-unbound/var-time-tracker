"use client";

import { Fragment } from "react";
import type { CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  SHIFT_BOARD_MATRIX_DATA_ROW_MIN_PX,
  shiftBoardGroupRowClass,
  shiftBoardMatrixStickyFirstColClass,
  shiftBoardPersonHrsStickyClass,
  shiftBoardProjectHeaderCellClass,
  shiftBoardTableHeaderClass,
} from "@/lib/shift-board-table-ui";

const MATRIX_LEFT = 260;
const MATRIX_COL_MIN = 200;

const PERSON_EMP = 220;
const PERSON_HRS = 100;
const PERSON_COL_MIN = 200;

const DEFAULT_PROJECTS = 5;
const SKELETON_MAX_PROJECTS = 12;

function clampProjectCount(n: number): number {
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_PROJECTS;
  }
  return Math.min(SKELETON_MAX_PROJECTS, Math.max(1, Math.floor(n)));
}

function matrixGridStyle(nProjects: number): CSSProperties {
  const w = `${MATRIX_LEFT + nProjects * MATRIX_COL_MIN}px`;
  return {
    minWidth: w,
    gridTemplateColumns: `${MATRIX_LEFT}px repeat(${nProjects}, minmax(${MATRIX_COL_MIN}px, 1fr))`,
  };
}

function personGridStyle(nProjects: number): CSSProperties {
  const w = PERSON_EMP + PERSON_HRS + nProjects * PERSON_COL_MIN;
  return {
    minWidth: `${w}px`,
    gridTemplateColumns: `${PERSON_EMP}px ${PERSON_HRS}px repeat(${nProjects}, minmax(${PERSON_COL_MIN}px, 1fr))`,
  };
}

type ShiftBoardMatrixSkeletonProps = {
  projectCount: number;
};

/** Layout-aligned placeholder for the matrix view while board data loads. */
export function ShiftBoardMatrixSkeleton({
  projectCount,
}: ShiftBoardMatrixSkeletonProps): JSX.Element {
  const n = clampProjectCount(projectCount);
  const grid = matrixGridStyle(n);

  return (
    <div
      className="overflow-x-auto rounded-input border border-border"
      aria-busy="true"
      aria-label="Loading shift board matrix"
      role="status"
    >
      <div className="grid w-full" style={grid}>
        <div
          className={`${shiftBoardTableHeaderClass} ${shiftBoardMatrixStickyFirstColClass} z-[35]`}
        >
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: n }, (_, i) => (
          <div
            key={`h-${i}`}
            className={shiftBoardProjectHeaderCellClass}
            aria-hidden
          >
            <Skeleton className="mx-auto h-3 w-4/5 max-w-[8rem]" />
          </div>
        ))}

        <div className="contents" aria-hidden>
          <div
            className={`${shiftBoardGroupRowClass} ${shiftBoardMatrixStickyFirstColClass} z-[32]`}
          >
            <Skeleton className="h-4 w-1/2 max-w-[12rem]" />
          </div>
          {Array.from({ length: n }, (_, i) => (
            <div
              key={`band-${i}`}
              className="box-border h-11 min-h-11 border-b border-l border-border/40"
            />
          ))}

          {[0, 1].map((r) => (
            <Fragment key={`ar-${r}`}>
              <div
                className={`${shiftBoardMatrixStickyFirstColClass} z-[32] box-border border-b border-r border-border bg-surface pl-1 pr-2 pt-1.5`}
                style={{ minHeight: SHIFT_BOARD_MATRIX_DATA_ROW_MIN_PX }}
              >
                <div className="flex items-start pl-1">
                  <span className="w-4 shrink-0" aria-hidden />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              {Array.from({ length: n }, (_, c) => (
                <div
                  key={`a-c-${r}-${c}`}
                  className="box-border flex min-h-0 flex-col border-b border-l border-border/30 p-1.5"
                  style={{ minHeight: SHIFT_BOARD_MATRIX_DATA_ROW_MIN_PX }}
                >
                  <Skeleton className="mb-1 h-7 w-full" />
                  <Skeleton className="h-7 w-full opacity-60" />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

type ShiftBoardPersonSkeletonProps = {
  projectCount: number;
};

/** Layout-aligned placeholder for the person view while data loads. */
export function ShiftBoardPersonSkeleton({
  projectCount,
}: ShiftBoardPersonSkeletonProps): JSX.Element {
  const n = clampProjectCount(projectCount);
  const grid = personGridStyle(n);
  const personRowH = 104;

  return (
    <div
      className="overflow-x-auto rounded-input border border-border"
      aria-busy="true"
      aria-label="Loading person view"
      role="status"
    >
      <div className="grid w-full" style={grid}>
        <div
          className={`${shiftBoardTableHeaderClass} sticky left-0 z-[35] box-border min-w-0 border-r border-border bg-surface`}
        >
          <Skeleton className="h-3 w-16" />
        </div>
        <div
          className={`${shiftBoardPersonHrsStickyClass} box-border flex h-11 min-h-11 items-center justify-center border-b border-border px-1`}
          style={{ left: PERSON_EMP }}
        >
          <Skeleton className="h-3 w-20" />
        </div>
        {Array.from({ length: n }, (_, i) => (
          <div
            key={`h-${i}`}
            className={shiftBoardProjectHeaderCellClass}
            aria-hidden
          >
            <Skeleton className="mx-auto h-3 w-4/5 max-w-[8rem]" />
          </div>
        ))}

        <div className="contents" aria-hidden>
          <div
            className={`${shiftBoardGroupRowClass} sticky left-0 z-[32] box-border min-w-0 border-r border-border bg-surface`}
          >
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div
            className={`${shiftBoardPersonHrsStickyClass} h-11 min-h-11 border-b border-border bg-surface/80`}
            style={{ left: PERSON_EMP }}
            aria-hidden
          />
          {Array.from({ length: n }, (_, i) => (
            <div
              key={`db-${i}`}
              className="box-border h-11 min-h-11 border-b border-l border-border/40"
            />
          ))}

          {Array.from({ length: 2 }, (__, row) => (
            <div
              key={`e-${row}`}
              className="contents"
              aria-hidden
            >
              <div
                className="sticky left-0 z-[32] box-border flex min-w-0 items-center border-b border-r border-border bg-surface pl-1 pr-2"
                style={{ minHeight: personRowH }}
              >
                <span className="w-4 shrink-0" aria-hidden />
                <Skeleton className="h-3 w-32" />
              </div>
              <div
                className={`${shiftBoardPersonHrsStickyClass} z-[32] box-border flex items-center justify-center border-b border-border px-1.5 text-center font-mono`}
                style={{ left: PERSON_EMP, minHeight: personRowH }}
              >
                <Skeleton className="h-3 w-8" />
              </div>
              {Array.from({ length: n }, (_, c) => (
                <div
                  key={`p-${row}-${c}`}
                  className="box-border flex min-h-0 flex-col border-b border-l border-border/30 p-1.5"
                  style={{ minHeight: personRowH }}
                >
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="mt-1 h-6 w-full opacity-70" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
