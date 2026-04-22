"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { CompetencyStatusToken } from "@/lib/competency-types";

const OPTIONS: { value: CompetencyStatusToken; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "expiring", label: "Expiring (30d)" },
];

interface CompetencyStatusMultiSelectProps {
  selected: CompetencyStatusToken[];
  onChange: (next: CompetencyStatusToken[]) => void;
}

function normalizeSelection(
  next: CompetencyStatusToken[],
  total: number,
): CompetencyStatusToken[] {
  if (total === 0) {
    return [];
  }
  if (next.length === total) {
    return [];
  }
  return next;
}

export function CompetencyStatusMultiSelect({
  selected,
  onChange,
}: CompetencyStatusMultiSelectProps): JSX.Element {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const total = OPTIONS.length;
  const summary = useMemo(() => {
    if (total === 0 || selected.length === 0) {
      return "(all)";
    }
    return `(${selected.length})`;
  }, [selected.length, total]);

  const isFiltered = selected.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return OPTIONS;
    }
    return OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function emit(next: CompetencyStatusToken[]): void {
    onChange(normalizeSelection(next, total));
  }

  function toggle(value: CompetencyStatusToken): void {
    if (selected.length === 0) {
      emit([value]);
      return;
    }
    if (selected.includes(value)) {
      emit(selected.filter((x) => x !== value));
      return;
    }
    emit([...selected, value]);
  }

  function clearSelection(): void {
    emit([]);
  }

  const checked = (value: CompetencyStatusToken): boolean => {
    if (selected.length === 0) {
      return false;
    }
    return selected.includes(value);
  };

  const statusLabel = "Competency status";

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        id={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${statusLabel}. ${
          selected.length === 0 || selected.length === total
            ? "All options"
            : `${selected.length} selected`
        }`}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center justify-between gap-1 rounded-input border px-2 py-2 text-left text-xs font-medium transition-colors ${
          isFiltered
            ? "border-primary bg-[rgba(27,58,92,0.06)] text-primary"
            : "border-border bg-surface text-text-primary hover:border-[#9aaec1]"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
          <span className="text-text-secondary">{statusLabel}</span>{" "}
          <span
            className={
              isFiltered ? "font-medium text-primary" : "text-text-primary"
            }
          >
            {summary}
          </span>
        </span>
        <svg
          aria-hidden
          className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 w-full min-w-[260px] max-w-[min(100vw-2rem,400px)] rounded-input border border-border bg-surface p-2 shadow-card"
          role="listbox"
          aria-labelledby={listboxId}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Search…"
            className="mb-2 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            autoComplete="off"
          />
          <div className="mb-2">
            <button
              type="button"
              onClick={clearSelection}
              disabled={selected.length === 0}
              className="rounded-input border border-border bg-appbg px-2 py-1 text-xs font-medium text-text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-52 overflow-y-auto overscroll-contain rounded-input border border-border">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-secondary">
                No matches
              </li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-appbg">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      checked={checked(o.value)}
                      onChange={() => {
                        toggle(o.value);
                      }}
                    />
                    <span className="select-none">{o.label}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
