"use client";

import { useCallback, useState } from "react";

import { SidebarMobileDrawer, SidebarRail } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

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
      <Topbar onOpenMobileNav={openMobileNav} />
      <div className="flex min-h-0 flex-1">
        <SidebarRail />
        <main className="min-h-[calc(100vh-52px)] min-w-0 flex-1 bg-appbg px-6 py-6">
          {children}
        </main>
      </div>
      <SidebarMobileDrawer open={mobileNavOpen} onClose={closeMobileNav} />
    </div>
  );
}
