"use client";

import { Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider, useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { Awesomebar } from "./awesomebar";
import { Navbar } from "./navbar";
import { Sidebar, SidebarNav } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ShellInner>{children}</ShellInner>
      </ToastProvider>
    </SessionProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && user === null) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k" || key === "g") { event.preventDefault(); setSearchOpen(true); }
      else if (key === "b") { event.preventDefault(); setSidebarHidden((v) => !v); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (loading || user === null) return null;

  return (
    <>
      <a href="#main" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      <Navbar
        sidebarHidden={sidebarHidden}
        onToggleSidebar={() => setSidebarHidden((v) => !v)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Mobile drawer toggle */}
      <div className="fixed bottom-4 left-4 z-40 lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
          <Menu />
        </Button>
      </div>

      <div className="flex">
        <aside
          className={cn(
            "sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-accent-line bg-surface",
            !sidebarHidden && "lg:block",
          )}
        >
          <Suspense fallback={<SidebarNav pathname={null} />}>
            <Sidebar />
          </Suspense>
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-canvas shadow-dropdown">
              <div className="flex h-14 items-center justify-between border-b border-accent-line px-3">
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
    </>
  );
}
