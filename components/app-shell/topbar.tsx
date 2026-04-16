"use client";

interface TopbarProps {
  onOpenMobileNav?: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps): JSX.Element {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      {onOpenMobileNav != null ? (
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input text-text-primary transition-colors hover:bg-appbg md:hidden"
          aria-label="Open menu"
          onClick={onOpenMobileNav}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      ) : null}
      <div className="min-w-0 text-sm font-medium text-text-secondary">
        VAR Electrochem Labor Tracker
      </div>
    </header>
  );
}
