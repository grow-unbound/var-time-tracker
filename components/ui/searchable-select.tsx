"use client";

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  id?: string;
  label: string;
  placeholder?: string;
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function SearchableSelect({
  id,
  label,
  placeholder = "Search…",
  options,
  value,
  onValueChange,
  disabled = false,
  emptyLabel = "No matches",
  className = "",
}: SearchableSelectProps): JSX.Element {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    if (
      selected &&
      query.trim().toLowerCase() === selected.label.toLowerCase()
    ) {
      return options;
    }
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, selected]);

  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? "");
    }
  }, [open, selected?.label]);

  useEffect(() => {
    if (!selected && value === "") {
      setQuery("");
    }
  }, [selected, value]);

  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open, filtered.length]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const choose = useCallback(
    (nextValue: string): void => {
      onValueChange(nextValue);
      setOpen(false);
      const opt = options.find((o) => o.value === nextValue);
      setQuery(opt?.label ?? "");
    },
    [onValueChange, options],
  );

  const clear = useCallback((): void => {
    onValueChange("");
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }, [onValueChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      if (!disabled && options.length > 0) {
        setOpen(true);
      }
      return;
    }
    if (!open) {
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery(selected?.label ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) =>
        filtered.length === 0 ? 0 : (i + 1) % filtered.length,
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) =>
        filtered.length === 0
          ? 0
          : (i - 1 + filtered.length) % filtered.length,
      );
      return;
    }
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      const opt = filtered[highlightIndex];
      if (opt) {
        choose(opt.value);
      }
    }
  };

  const inputId = id ?? `${listId}-input`;

  return (
    <div ref={rootRef} className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm text-text-primary" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && filtered[highlightIndex]
              ? `${listId}-opt-${filtered[highlightIndex].value}`
              : undefined
          }
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-input border border-border bg-surface py-2 text-sm hover:border-[#9aaec1] focus-visible:border-primary disabled:opacity-60 ${
            value !== "" && !disabled ? "pl-3 pr-9" : "px-3"
          }`}
          value={open ? query : selected?.label ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (next === "") {
              onValueChange("");
            }
          }}
          onFocus={() => {
            if (!disabled) {
              setQuery(selected?.label ?? "");
              setOpen(true);
            }
          }}
          onClick={() => {
            if (!disabled && options.length > 0) {
              setQuery(selected?.label ?? "");
              setOpen(true);
            }
          }}
          onKeyDown={onKeyDown}
        />
        {!disabled && value !== "" ? (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-text-secondary transition-colors hover:bg-appbg hover:text-text-primary"
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => {
              e.preventDefault();
              clear();
            }}
          >
            <span className="text-lg leading-none" aria-hidden>
              ×
            </span>
          </button>
        ) : null}
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 w-full overflow-auto rounded-input border border-border bg-surface py-1 shadow-card"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-secondary">
              {emptyLabel}
            </li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listId}-opt-${opt.value}`}
                role="option"
                aria-selected={value === opt.value}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === highlightIndex
                    ? "bg-appbg text-text-primary"
                    : "text-text-primary hover:bg-appbg/70"
                } ${value === opt.value ? "font-medium" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(opt.value);
                }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
      </div>
    </div>
  );
}
