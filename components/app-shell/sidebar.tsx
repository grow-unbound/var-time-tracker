"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/log",
    label: "Log Time",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    href: "/entries",
    label: "All Entries",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    ),
  },
  {
    href: "/competency",
    label: "Competency matrix",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <path d="m7 7 10 10" />
        <path d="m17 7-10 10" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "Project planning",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19h16" />
        <path d="M6 19V9l6-4 6 4v10" />
        <path d="M10 19v-4h4v4" />
      </svg>
    ),
  },
  {
    href: "/shift-board",
    label: "Production Planning",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

function isActivePath(currentPath: string, href: string): boolean {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath.startsWith(href);
}

function getTodayDisplay(): {
  todayLabel: string;
  weekday: string;
  day: string;
  month: string;
} {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const parts = formatter.formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    todayLabel: formatter.format(d),
    weekday: part("weekday"),
    day: part("day"),
    month: part("month"),
  };
}

interface SidebarBrandProps {
  variant: "rail" | "drawer";
}

function SidebarBrand({ variant }: SidebarBrandProps): JSX.Element {
  const isRail = variant === "rail";

  return (
    <div
      className={[
        "shrink-0 border-b border-white/10",
        isRail
          ? [
              "px-4 pb-3 pt-5",
              "md:px-[13px] md:pb-3 md:pt-4",
              "md:flex md:flex-col md:items-center",
              "md:group-hover:items-start",
              "lg:items-start",
            ].join(" ")
          : "px-4 pb-3 pt-5",
      ].join(" ")}
    >
      <Link
        href="/"
        className={[
          "inline-flex max-w-full rounded-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          isRail
            ? "md:mx-auto md:group-hover:mx-0 lg:mx-0"
            : "",
        ].join(" ")}
        aria-label="VAR Electrochem — home"
      >
        <div
          className={
            isRail
              ? [
                  "flex w-full max-w-[180px] justify-center overflow-hidden",
                  "md:max-w-[48px]",
                  "md:group-hover:max-w-[180px] md:group-focus-within:max-w-[180px]",
                  "lg:max-w-[180px] lg:justify-start",
                ].join(" ")
              : "max-w-[180px]"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/var-logo.svg"
            alt=""
            width={180}
            height={40}
            className="h-9 w-auto object-contain object-left"
          />
        </div>
      </Link>
      <p
        className={[
          "mt-2 text-xs font-medium leading-snug text-sidebar",
          isRail
            ? [
                "hidden text-left lg:block",
                "md:group-hover:block md:group-focus-within:block",
              ].join(" ")
            : "text-left",
        ].join(" ")}
      >
        Labor Time Tracker
      </p>
    </div>
  );
}

interface SidebarNavProps {
  pathname: string;
  variant: "rail" | "drawer";
}

function SidebarNav({ pathname, variant }: SidebarNavProps): JSX.Element {
  const isRail = variant === "rail";

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 px-0 pt-1">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
            className={[
              "flex h-10 items-center border-l-[3px] text-sm font-medium transition-colors",
              isRail
                ? [
                    "px-[13px]",
                    "md:justify-center md:px-0",
                    "md:group-hover:justify-start md:group-hover:px-[13px]",
                    "md:group-focus-within:justify-start md:group-focus-within:px-[13px]",
                    "lg:justify-start lg:px-[13px]",
                  ].join(" ")
                : "justify-start px-[13px]",
              active
                ? "border-accent bg-white/10 text-white"
                : "border-transparent text-sidebar hover:bg-white/5",
            ].join(" ")}
          >
            <span className="shrink-0">{item.icon}</span>
            <span
              className={
                isRail
                  ? [
                      "ml-3 whitespace-nowrap",
                      "hidden lg:inline",
                      "md:group-hover:inline md:group-focus-within:inline",
                    ].join(" ")
                  : "ml-3 inline whitespace-nowrap"
              }
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarDateFooter(
  props:
    | { variant: "drawer"; todayLabel: string }
    | {
        variant: "rail";
        todayLabel: string;
        weekday: string;
        day: string;
        month: string;
      },
): JSX.Element {
  if (props.variant === "drawer") {
    return (
      <div className="mt-auto px-4 pb-5 pt-4 text-left text-xs text-sidebar">
        <span>Today: {props.todayLabel}</span>
      </div>
    );
  }

  const { todayLabel, weekday, day, month } = props;

  return (
    <div
      className={[
        "mt-auto px-4 pb-5 pt-4 text-xs text-sidebar",
        "md:px-0 md:text-center",
        "md:group-hover:px-4 md:group-hover:text-left",
        "md:group-focus-within:px-4 md:group-focus-within:text-left",
        "lg:px-4 lg:text-left",
      ].join(" ")}
    >
      <span
        className={[
          "hidden lg:inline",
          "md:group-hover:inline md:group-focus-within:inline",
        ].join(" ")}
      >
        Today: {todayLabel}
      </span>
      <span
        aria-label={`Today: ${todayLabel}`}
        className={[
          "whitespace-pre-line leading-tight",
          "hidden md:inline-block lg:hidden",
          "md:group-hover:hidden md:group-focus-within:hidden",
        ].join(" ")}
      >
        {`${weekday}\n${day} ${month}`}
      </span>
    </div>
  );
}

/** In-flow rail: main content width follows sidebar (tablet hover expand). */
export function SidebarRail(): JSX.Element {
  const pathname = usePathname();
  const { todayLabel, weekday, day, month } = getTodayDisplay();

  return (
    <aside
      className={[
        "group relative z-20 hidden flex-col bg-primary md:flex",
        "md:sticky md:top-0 md:h-screen md:max-h-[100dvh] md:shrink-0",
        "md:w-12 md:overflow-hidden md:transition-[width] md:duration-200 md:ease-out",
        "md:hover:w-[220px] md:focus-within:w-[220px]",
        "lg:w-[220px] lg:overflow-visible",
      ].join(" ")}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <SidebarBrand variant="rail" />
        <SidebarNav pathname={pathname} variant="rail" />
        <SidebarDateFooter
          variant="rail"
          todayLabel={todayLabel}
          weekday={weekday}
          day={day}
          month={month}
        />
      </div>
    </aside>
  );
}

interface SidebarMobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Full-height drawer overlay; only used below `md`. */
export function SidebarMobileDrawer({
  open,
  onClose,
}: SidebarMobileDrawerProps): JSX.Element | null {
  const pathname = usePathname();
  const openRef = useRef(open);
  openRef.current = open;
  const { todayLabel } = getTodayDisplay();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (openRef.current) {
      onClose();
    }
  }, [pathname, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-30 bg-black/40 md:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed left-0 top-0 z-40 flex h-full min-h-[100dvh] w-[220px] flex-col bg-primary shadow-lg md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SidebarBrand variant="drawer" />
          <SidebarNav pathname={pathname} variant="drawer" />
          <SidebarDateFooter variant="drawer" todayLabel={todayLabel} />
        </div>
      </aside>
    </>
  );
}
