"use client";

import { ChevronRight, House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { findWorkspace, workspaces } from "@/lib/navigation/registry";

const isWithin = (pathname: string | null, href: string) =>
  pathname === href || !!pathname?.startsWith(`${href}/`);

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <SidebarNav pathname={usePathname()} onNavigate={onNavigate} />;
}

export function SidebarNav({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const current = pathname === null ? undefined : findWorkspace(pathname);

  return (
    <nav aria-label="Modules" className="flex flex-col gap-0.5 bg-surface px-2 py-3 text-sm">
      <TopLink href="/" active={pathname === "/"} icon={<House />} onNavigate={onNavigate}>
        Home
      </TopLink>

      <p className="mt-4 mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Modules</p>

      {workspaces.map((workspace) => {
        const Icon = workspace.icon;

        if (workspace.status === "planned") {
          return (
            <span
              key={workspace.id}
              aria-disabled="true"
              title={`${workspace.label} is not built yet`}
              className="flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-ink-faint [&_svg]:size-4"
            >
              <Icon aria-hidden="true" />
              <span className="flex-1 truncate">{workspace.label}</span>
              <span className="rounded border border-line px-1 text-[10px] font-medium uppercase">Soon</span>
            </span>
          );
        }

        const cards = workspace.cards ?? [];
        return (
          <CollapsibleWorkspace
            key={workspace.id}
            label={workspace.label}
            icon={<Icon />}
            active={current?.id === workspace.id}
          >
            {cards.map((card) =>
              card.label ? (
                <CollapsibleGroup
                  key={card.label}
                  label={card.label}
                  count={card.links.length}
                  active={
                    (!!card.href && isWithin(pathname, card.href)) || card.links.some((link) => isWithin(pathname, link.href))
                  }
                >
                  {card.links.map((link) => (
                    <li key={link.href}>
                      <SubLink href={link.href} active={isWithin(pathname, link.href)} onNavigate={onNavigate}>
                        {link.label}
                      </SubLink>
                    </li>
                  ))}
                </CollapsibleGroup>
              ) : (
                card.links.map((link) => (
                  <li key={link.href} className="list-none">
                    <SubLink href={link.href} active={isWithin(pathname, link.href)} onNavigate={onNavigate}>
                      {link.label}
                    </SubLink>
                  </li>
                ))
              ),
            )}
          </CollapsibleWorkspace>
        );
      })}
    </nav>
  );
}

/**
 * Open/closed state of a collapsible menu entry. Starts open when the entry holds
 * the current page and re-opens whenever navigation moves into it; the user can
 * still collapse it.
 */
function useOpenWhenActive(active: boolean) {
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpen(true);
  }
  return [open, setOpen] as const;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 text-ink-faint transition-transform duration-150", open && "rotate-90")}
    />
  );
}

function CollapsibleWorkspace({
  label,
  icon,
  active,
  children,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useOpenWhenActive(active);
  const listId = useId();

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 transition-colors focus-visible:outline-2 [&_svg]:size-4 [&_svg]:shrink-0",
          active ? "font-semibold text-accent-strong dark:text-accent" : "text-ink-muted hover:bg-control hover:text-ink",
        )}
      >
        <span aria-hidden="true" className={cn(active ? "text-accent-strong dark:text-accent" : "text-ink-faint")}>
          {icon}
        </span>
        <span className="flex-1 truncate text-left">{label}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <ul id={listId} className="mb-1 flex flex-col gap-0.5 pl-4">
          {children}
        </ul>
      )}
    </div>
  );
}

function CollapsibleGroup({
  label,
  count,
  active,
  children,
}: {
  label: string;
  count: number;
  /** The group holds the current page. */
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useOpenWhenActive(active);
  const listId = useId();

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md pr-2.5 pl-3 text-[13px] transition-colors hover:bg-control focus-visible:outline-2",
          active ? "font-medium text-ink" : "text-ink-muted hover:text-ink",
        )}
      >
        <span className="flex-1 truncate text-left">{label}</span>
        {!open && <span className="text-[11px] text-ink-faint tabular-nums">{count}</span>}
        <Chevron open={open} />
      </button>
      {open && (
        <ul id={listId} className="ml-3 flex flex-col gap-0.5 border-l border-line py-0.5 pl-0">
          {children}
        </ul>
      )}
    </li>
  );
}

/** Top-level entry (Home). */
function TopLink({
  href,
  active,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-2.5 transition-colors focus-visible:outline-2 [&_svg]:size-4 [&_svg]:shrink-0",
        active
          ? "bg-accent-soft font-semibold text-accent-strong dark:text-accent"
          : "text-ink-muted hover:bg-control hover:text-ink [&_svg]:text-ink-faint",
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  );
}

/** Page link inside a group; the active one gets a blue bar on the guide line. */
function SubLink({
  href,
  active,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative -ml-px flex h-8 items-center rounded-r-md border-l-2 pr-2.5 pl-3 text-[13px] transition-colors focus-visible:outline-2",
        active
          ? "border-accent-strong bg-accent-soft font-medium text-accent-strong dark:border-accent dark:text-accent"
          : "border-transparent text-ink-muted hover:border-line-strong hover:bg-control hover:text-ink",
      )}
    >
      <span className="truncate">{children}</span>
    </Link>
  );
}
