"use client";

import { ChevronRight, House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { findWorkspace, workspaces } from "@/lib/navigation/registry";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <SidebarNav pathname={usePathname()} onNavigate={onNavigate} />;
}

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
        const hasCards = (workspace.cards ?? []).length > 0;

        return (
          <CollapsibleWorkspace
            key={workspace.id}
            label={workspace.label}
            icon={<Icon />}
            defaultOpen={isCurrent}
            active={isCurrent}
          >
            {hasCards && (
              <ul className="flex flex-col gap-0.5">
                {(workspace.cards ?? []).map((card) => {
                  const anyLinkActive = card.links.some(
                    (link) => pathname === link.href || !!pathname?.startsWith(`${link.href}/`),
                  );
                  return (
                    <CollapsibleGroup
                      key={card.label}
                      label={card.label}
                      defaultOpen={anyLinkActive}
                    >
                      {card.links.map((link) => (
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
                    </CollapsibleGroup>
                  );
                })}
              </ul>
            )}
          </CollapsibleWorkspace>
        );
      })}
    </nav>
  );
}

function CollapsibleWorkspace({
  label,
  icon,
  defaultOpen,
  active,
  children,
}: {
  label: string;
  icon: ReactNode;
  defaultOpen: boolean;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg px-2 transition-colors focus-visible:outline-2 [&_svg]:size-4 [&_svg]:shrink-0",
          active
            ? "bg-surface font-medium text-ink shadow-sm dark:bg-control"
            : "text-ink-muted hover:bg-control hover:text-ink",
        )}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronRight
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <ul className="ml-4 flex flex-col gap-0.5 border-l border-line pl-2">
          {children}
        </ul>
      )}
    </div>
  );
}

function CollapsibleGroup({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-ink-muted transition-colors hover:bg-control hover:text-ink focus-visible:outline-2"
      >
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronRight
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <ul className="ml-4 flex flex-col gap-0.5 border-l border-line pl-2">
          {children}
        </ul>
      )}
    </li>
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
        active
          ? "bg-surface font-medium text-ink shadow-sm dark:bg-control"
          : "text-ink-muted hover:bg-control hover:text-ink",
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="truncate">{children}</span>
    </Link>
  );
}
