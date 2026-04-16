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
    href: "/all-entries",
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
];

function isActivePath(currentPath: string, href: string): boolean {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath.startsWith(href);
}

interface SidebarNavProps {
  pathname: string;
  variant: "rail" | "drawer";
}

function SidebarNav({ pathname, variant }: SidebarNavProps): JSX.Element {
  const isRail = variant === "rail";

  return (
    <nav aria-label="Primary" className="mt-2 flex flex-col gap-1 px-0">
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
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());
  const [weekday, day, month] = todayLabel.split(" ");

  return (
    <aside
      className={[
        "group relative z-20 hidden flex-col bg-primary md:flex",
        "md:sticky md:top-[52px] md:h-[calc(100vh-52px)] md:shrink-0",
        "md:w-12 md:overflow-hidden md:transition-[width] md:duration-200 md:ease-out",
        "md:hover:w-[220px] md:focus-within:w-[220px]",
        "lg:w-[220px] lg:overflow-visible",
      ].join(" ")}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col">
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

/** Full-width drawer below topbar; only used below `md`. */
export function SidebarMobileDrawer({
  open,
  onClose,
}: SidebarMobileDrawerProps): JSX.Element | null {
  const pathname = usePathname();
  const openRef = useRef(open);
  openRef.current = open;
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());

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
        className="fixed inset-0 top-[52px] z-30 bg-black/40 md:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed left-0 top-[52px] z-40 flex h-[calc(100vh-52px)] w-[220px] flex-col bg-primary shadow-lg md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SidebarNav pathname={pathname} variant="drawer" />
          <SidebarDateFooter variant="drawer" todayLabel={todayLabel} />
        </div>
      </aside>
    </>
  );
}
