"use client";

import { useCallback, useState } from "react";

import { SidebarMobileDrawer, SidebarRail } from "@/components/app-shell/sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openMobileNav = useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-appbg text-text-primary">
      <button
        type="button"
        aria-label="Open menu"
        onClick={openMobileNav}
        className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-input border border-border bg-surface text-text-primary shadow-card md:hidden"
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
      <div className="flex min-h-0 flex-1">
        <SidebarRail />
        <main className="min-h-screen min-w-0 flex-1 bg-appbg px-6 pb-6 pt-16 md:px-6 md:py-6">
          {children}
        </main>
      </div>
      <SidebarMobileDrawer open={mobileNavOpen} onClose={closeMobileNav} />
    </div>
  );
}
