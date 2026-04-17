"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SearchableMultiSelectOption {
  id: number;
  label: string;
}

interface SearchableMultiSelectProps {
  id?: string;
  label: string;
  options: SearchableMultiSelectOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

function normalizeSelection(
  next: number[],
  total: number,
): number[] {
  if (total === 0) {
    return [];
  }
  if (next.length === total) {
    return [];
  }
  return next;
}

export function SearchableMultiSelect({
  id: providedId,
  label,
  options,
  selectedIds,
  onChange,
}: SearchableMultiSelectProps): JSX.Element {
  const autoId = useId();
  const listboxId = providedId ?? `sms-${autoId}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const total = options.length;
  const summary = useMemo(() => {
    if (total === 0 || selectedIds.length === 0) {
      return "(all)";
    }
    return `(${selectedIds.length})`;
  }, [selectedIds.length, total]);

  const isFiltered = selectedIds.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

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

  function emit(next: number[]): void {
    onChange(normalizeSelection(next, total));
  }

  function toggleOption(optionId: number): void {
    if (selectedIds.length === 0) {
      emit([optionId]);
      return;
    }
    if (selectedIds.includes(optionId)) {
      const next = selectedIds.filter((x) => x !== optionId);
      emit(next);
      return;
    }
    emit([...selectedIds, optionId]);
  }

  function clearSelection(): void {
    emit([]);
  }

  const checked = (optionId: number): boolean => {
    if (selectedIds.length === 0) {
      return false;
    }
    return selectedIds.includes(optionId);
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
        {label}
      </span>
      <button
        type="button"
        id={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center justify-between gap-1 rounded-input border px-2 py-2 text-left text-xs font-medium transition-colors ${
          isFiltered
            ? "border-primary bg-[rgba(27,58,92,0.06)] text-primary"
            : "border-border bg-surface text-text-primary hover:border-[#9aaec1]"
        }`}
      >
        <span className="truncate">{summary}</span>
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
              disabled={selectedIds.length === 0}
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
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-appbg">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      checked={checked(o.id)}
                      onChange={() => {
                        toggleOption(o.id);
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
