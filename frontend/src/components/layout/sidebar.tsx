"use client";

import { House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { findWorkspace, workspaceLinks, workspaces } from "@/lib/navigation/registry";

/**
 * ERPNext workspace sidebar: modules, with the current module's pages nested
 * under it. Reads the URL, so render it inside <Suspense> with
 * <SidebarNav pathname={null} /> as the fallback.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <SidebarNav pathname={usePathname()} onNavigate={onNavigate} />;
}

/** Sidebar markup; `pathname: null` renders it without an active item (prerender fallback). */
export function SidebarNav({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const current = pathname === null ? undefined : findWorkspace(pathname);

  return (
    <nav aria-label="Modules" className="flex flex-col gap-0.5 p-2 text-sm">
      <SidebarLink href="/" active={pathname === "/"} icon={<House />} onNavigate={onNavigate}>
        Home
      </SidebarLink>
      <p className="mt-4 mb-1 px-2 text-xs font-medium text-ink-faint uppercase">Modules</p>
      {workspaces.map((workspace) => {
        const Icon = workspace.icon;
        if (workspace.status === "planned") {
          return (
            <span
              key={workspace.id}
              aria-disabled="true"
              title={`${workspace.label} is not built yet`}
              className="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-ink-faint [&_svg]:size-4"
            >
              <Icon aria-hidden="true" />
              <span className="flex-1">{workspace.label}</span>
              <span className="rounded bg-control px-1 text-[10px] uppercase">Soon</span>
            </span>
          );
        }
        const isCurrent = current?.id === workspace.id;
        // Unique links of this workspace, nested when it is the current one.
        const links = [...new Map(workspaceLinks(workspace).map((link) => [link.href, link])).values()];
        return (
          <div key={workspace.id} className="flex flex-col gap-0.5">
            <SidebarLink
              href={workspace.href}
              active={pathname === workspace.href}
              icon={<Icon />}
              onNavigate={onNavigate}
            >
              {workspace.label}
            </SidebarLink>
            {isCurrent && links.length > 0 && (
              <ul className="ml-4 flex flex-col gap-0.5 border-l border-line pl-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <SidebarLink
                      href={link.href}
                      active={pathname === link.href || !!pathname?.startsWith(`${link.href}/`)}
                      onNavigate={onNavigate}
                    >
                      {link.label}
                    </SidebarLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg px-2 transition-colors focus-visible:outline-2 [&_svg]:size-4 [&_svg]:shrink-0",
        active ? "bg-surface font-medium text-ink shadow-sm dark:bg-control" : "text-ink-muted hover:bg-control hover:text-ink",
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="truncate">{children}</span>
    </Link>
  );
}
