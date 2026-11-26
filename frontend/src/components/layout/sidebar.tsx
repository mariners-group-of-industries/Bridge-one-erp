"use client";

import { ChevronRight, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/session";
import { findWorkspace, PINNED_WORKSPACES, workspaces as allWorkspaces } from "@/lib/navigation/registry";
import type { NavLink } from "@/lib/navigation/types";
import { essNavigation, essPaths } from "@/features/ess/navigation";

const isWithin = (pathname: string | null, href: string) => pathname === href || !!pathname?.startsWith(`${href}/`);
const isPageActive = (pathname: string | null, href: string, exact = false) =>
  exact || allWorkspaces.some((workspace) => workspace.href === href) ? pathname === href : isWithin(pathname, href);

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <SidebarNav pathname={usePathname()} onNavigate={onNavigate} />;
}

/**
 * Three-level menu: module (icon) › group (● bullet) › page (○ bullet). Guide
 * lines connect each level to its parent; the current page's bullet is filled.
 */
export function SidebarNav({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const current = pathname === null ? undefined : findWorkspace(pathname);
  // Only modules and pages the user may open.
  const { workspaces: visible, user } = useSession();
  const pinned = visible.filter((workspace) => PINNED_WORKSPACES.has(workspace.id));
  const workspaces = visible.filter((workspace) => !PINNED_WORKSPACES.has(workspace.id));

  return (
    <nav aria-label="Modules" className="flex flex-col bg-surface px-1.5 py-2 text-[13px]">
      {/* Home (business overview) is for the master account only; others start at My Workspace. */}
      {user?.isMaster && (
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md px-1.5 transition-colors focus-visible:outline-2",
            pathname === "/" ? "bg-accent-soft font-semibold text-accent-strong dark:text-accent" : "text-ink-muted hover:bg-control hover:text-ink",
          )}
        >
          <IconTile active={pathname === "/"}>
            <House />
          </IconTile>
          <span className="truncate">Home</span>
        </Link>
      )}

      {pinned.map((workspace) => {
        const Icon = workspace.icon;
        const active = isWithin(pathname, workspace.href);
        return (
          <Link
            key={workspace.id}
            href={workspace.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            title={workspace.description}
            className={cn(
              "mt-0.5 flex h-8 items-center gap-2 rounded-md px-1.5 transition-colors focus-visible:outline-2",
              active ? "bg-accent-soft font-semibold text-accent-strong dark:text-accent" : "text-ink-muted hover:bg-control hover:text-ink",
            )}
          >
            <IconTile active={active}>
              <Icon />
            </IconTile>
            <span className="truncate">{workspace.label}</span>
          </Link>
        );
      })}

      {/* Employee Self Service: for any login linked to an employee record, whatever its module permissions. */}
      {user?.employee && <MyWorkspace pathname={pathname} onNavigate={onNavigate} />}

      <p className="mt-3.5 mb-1 flex items-center gap-2 px-1.5 text-[10px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
        Modules
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </p>

      <ul className="flex flex-col gap-0.5">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;
          if (workspace.status === "planned") {
            return (
              <li key={workspace.id}>
                <span aria-disabled="true" title={`${workspace.label} is coming soon`} className="flex h-8 cursor-default items-center gap-2 rounded-md px-1.5 text-ink-faint">
                  <IconTile muted>
                    <Icon />
                  </IconTile>
                  <span className="flex-1 truncate">{workspace.label}</span>
                  <span className="rounded-full border border-line px-1.5 text-[9.5px] font-semibold tracking-wide uppercase">Soon</span>
                </span>
              </li>
            );
          }

          const active = current?.id === workspace.id;
          const cards = workspace.cards ?? [];
          // Flat page lists (Sales) and unnamed cards sit directly under the module.
          const flat: readonly NavLink[] | null = workspace.sidebarLinks ?? null;
          if (cards.length === 0 && (!flat || flat.length === 0)) {
            const external = workspace.href.startsWith("http");
            return (
              <li key={workspace.id}>
                <Link
                  href={workspace.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-1.5 transition-colors focus-visible:outline-2",
                    active ? "text-ink" : "text-ink-muted hover:bg-control hover:text-ink",
                  )}
                >
                  <IconTile active={active}>
                    <Icon />
                  </IconTile>
                  <span className={cn("flex-1 truncate text-left", active ? "font-semibold text-ink" : "font-medium")}>{workspace.label}</span>
                  <Chevron open={false} />
                </Link>
              </li>
            );
          }
          return (
            <li key={workspace.id}>
              <Collapsible
                active={active}
                trigger={(open) => (
                  <>
                    <IconTile active={active}>
                      <Icon />
                    </IconTile>
                    <span className={cn("flex-1 truncate text-left", active ? "font-semibold text-ink" : "font-medium")}>{workspace.label}</span>
                    <Chevron open={open} />
                  </>
                )}
                triggerClass={cn("h-8 gap-2 px-1.5", active ? "text-ink" : "text-ink-muted hover:bg-control hover:text-ink")}
              >
                {/* Guide line runs from the module icon down through its groups. */}
                <ul className="mt-0.5 mb-1 ml-[0.9rem] flex flex-col gap-px border-l border-line pl-1.5">
                  {flat
                    ? flat.map((link) => <PageLink key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} level={1} />)
                    : cards.map((card) =>
                        card.label ? (
                          <GroupItem key={card.label} label={card.label} links={card.links} groupHref={card.href} pathname={pathname} onNavigate={onNavigate} />
                        ) : (
                          card.links.map((link) => <PageLink key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} level={1} />)
                        ),
                      )}
                </ul>
              </Collapsible>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "My Workspace": the signed-in employee's own pages (Employee Self Service). */
function MyWorkspace({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const active = isWithin(pathname, essPaths.root) || pathname === essPaths.account;
  return (
    <div className="mt-0.5">
      <Collapsible
        active={active}
        trigger={(open) => (
          <>
            <IconTile active={active}>
              <UserRound />
            </IconTile>
            <span className={cn("flex-1 truncate text-left", active ? "font-semibold text-ink" : "font-medium")}>My Workspace</span>
            <Chevron open={open} />
          </>
        )}
        triggerClass={cn("h-8 gap-2 px-1.5", active ? "text-ink" : "text-ink-muted hover:bg-control hover:text-ink")}
      >
        <ul className="mt-0.5 mb-1 ml-[0.9rem] flex flex-col gap-px border-l border-line pl-1.5">
          {essNavigation.map((card) =>
            card.links.length === 1 ? (
              <PageLink key={card.label} link={card.links[0]} pathname={pathname} onNavigate={onNavigate} level={1} />
            ) : (
              <GroupItem key={card.label} label={card.label} links={card.links} pathname={pathname} onNavigate={onNavigate} />
            ),
          )}
        </ul>
      </Collapsible>
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function IconTile({ active, muted, children }: { active?: boolean; muted?: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors [&_svg]:size-3",
        active ? "border-accent-line bg-accent-soft text-accent-strong dark:text-accent" : muted ? "border-dashed border-line text-ink-faint" : "border-line bg-canvas text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return <ChevronRight aria-hidden="true" className={cn("size-3.5 shrink-0 text-ink-faint transition-transform duration-150", open && "rotate-90")} />;
}

/**
 * Open/closed state of a collapsible entry. Starts open when it holds the
 * current page and re-opens whenever navigation moves into it.
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

function Collapsible({ active, trigger, triggerClass, children }: { active: boolean; trigger: (open: boolean) => ReactNode; triggerClass: string; children: ReactNode }) {
  const [open, setOpen] = useOpenWhenActive(active);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn("flex w-full items-center rounded-md transition-colors focus-visible:outline-2", triggerClass)}
      >
        {trigger(open)}
      </button>
      {open && <div id={id}>{children}</div>}
    </>
  );
}

/** Second level: a group of pages with a filled bullet. */
function GroupItem({ label, links, groupHref, pathname, onNavigate }: { label: string; links: readonly NavLink[]; groupHref?: string; pathname: string | null; onNavigate?: () => void }) {
  const active = (!!groupHref && isWithin(pathname, groupHref)) || links.some((link) => isPageActive(pathname, link.href, link.exact));
  return (
    <li>
      <Collapsible
        active={active}
        triggerClass={cn("h-7 gap-1.5 pr-1.5 pl-1 text-[12.5px]", active ? "text-ink" : "text-ink-muted hover:bg-control hover:text-ink")}
        trigger={(open) => (
          <>
            <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-accent-strong dark:bg-accent" : "bg-ink-faint")} />
            <span className={cn("flex-1 truncate text-left", active && "font-semibold")}>{label}</span>
            <Chevron open={open} />
          </>
        )}
      >
        <ul className="mb-1 ml-[0.55rem] flex flex-col gap-px border-l border-dashed border-line pl-1">
          {links.map((link) => (
            <PageLink key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} level={2} />
          ))}
        </ul>
      </Collapsible>
    </li>
  );
}

/** A page: hollow bullet (filled and highlighted when it is the current page). */
function PageLink({ link, pathname, onNavigate, level }: { link: NavLink; pathname: string | null; onNavigate?: () => void; level: 1 | 2 }) {
  const active = isPageActive(pathname, link.href, link.exact);
  return (
    <li>
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        title={link.description}
        className={cn(
          "flex items-center gap-1.5 rounded-md pr-1.5 transition-colors focus-visible:outline-2",
          level === 1 ? "h-7 pl-1 text-[12px]" : "h-6.5 pl-1 text-[11.5px]",
          active ? "bg-accent-soft font-medium text-accent-strong dark:text-accent" : "text-ink-muted hover:bg-control hover:text-ink",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 rounded-full border",
            level === 1 ? "size-1.5" : "size-[5px]",
            active ? "border-accent-strong bg-accent-strong dark:border-accent dark:bg-accent" : "border-ink-faint bg-transparent",
          )}
        />
        <span className="truncate">{link.label}</span>
      </Link>
    </li>
  );
}
