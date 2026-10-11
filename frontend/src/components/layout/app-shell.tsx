"use client";

import { Menu, PanelLeft, Search, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { Awesomebar } from "./awesomebar";
import { Breadcrumbs } from "./breadcrumbs";
import { Sidebar, SidebarNav } from "./sidebar";
import { UserMenu } from "./user-menu";

/**
 * ERPNext desk layout: sticky navbar (logo, breadcrumbs, awesomebar, avatar),
 * workspace sidebar and the page area. Wraps every page in the (erp) group.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k" || key === "g") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (key === "b") {
        event.preventDefault();
        setSidebarHidden((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
          <Menu />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
          aria-pressed={!sidebarHidden}
          onClick={() => setSidebarHidden((value) => !value)}
        >
          <PanelLeft />
        </Button>
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg"
          >
            B
          </span>
          <span className="hidden text-base font-semibold text-ink sm:inline">BridgeOne</span>
        </Link>
        {/* URL-dependent parts stream in after the prerendered shell. */}
        <Suspense fallback={null}>
          <Breadcrumbs />
        </Suspense>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="ml-auto flex h-7 w-9 items-center gap-2 rounded-lg bg-control px-2 text-sm text-ink-faint hover:bg-hover focus-visible:outline-2 sm:w-72"
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="hidden flex-1 text-left sm:inline">Search or type a command</span>
          <span className="sr-only sm:hidden">Search</span>
          <span className="hidden sm:inline-flex">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
        <UserMenu />
      </header>

      <div className="flex">
        <aside
          className={cn(
            "sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 overflow-y-auto border-r border-line",
            !sidebarHidden && "lg:block",
          )}
        >
          <Suspense fallback={<SidebarNav pathname={null} />}>
            <Sidebar />
          </Suspense>
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/30"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-canvas shadow-dropdown">
              <div className="flex h-12 items-center justify-between border-b border-line px-3">
                <span className="text-base font-semibold">BridgeOne</span>
                <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
                  <X />
                </Button>
              </div>
              <Suspense fallback={<SidebarNav pathname={null} />}>
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
              </Suspense>
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <Awesomebar open={searchOpen} onClose={() => setSearchOpen(false)} />
    </ToastProvider>
  );
}
