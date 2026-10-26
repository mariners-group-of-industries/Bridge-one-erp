import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Workspace } from "@/lib/navigation/types";
import { PageContainer, PageHead } from "./page";

/** Module landing page: shortcut tiles and grouped links, in the Purchase module style. */
export function WorkspaceView({ workspace }: { workspace: Workspace }) {
  return (
    <PageContainer>
      <PageHead title={workspace.label} subtitle={workspace.description} />
      <div className="flex flex-col gap-4">
        {workspace.shortcuts && workspace.shortcuts.length > 0 && (
          <section aria-labelledby={`${workspace.id}-shortcuts`} className="flex flex-col gap-2">
            <h2 id={`${workspace.id}-shortcuts`} className="text-xs font-bold tracking-wide text-ink uppercase">
              Your Shortcuts
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {workspace.shortcuts.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex h-full items-center justify-between gap-2 rounded border border-l-4 border-line border-l-accent bg-surface px-3.5 py-3 text-sm font-semibold text-ink shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-2"
                  >
                    {link.label}
                    <ArrowUpRight aria-hidden="true" className="size-4 text-ink-faint group-hover:text-accent-strong" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {workspace.cards && workspace.cards.length > 0 && (
          <section aria-labelledby={`${workspace.id}-cards`} className="flex flex-col gap-2">
            <h2 id={`${workspace.id}-cards`} className="text-xs font-bold tracking-wide text-ink uppercase">
              Reports &amp; Masters
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspace.cards.map((card, index) => (
                <div key={card.label || `card-${index}`} className="rounded border border-line bg-surface p-4 shadow-xs">
                  {card.label && (
                    <h3 className="mb-2 border-b border-line pb-2 text-xs font-bold tracking-wide text-ink uppercase">
                      {card.label}
                    </h3>
                  )}
                  <ul className="flex flex-col">
                    {card.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="group -mx-2 flex items-start gap-1 rounded px-2 py-1.5 hover:bg-control focus-visible:outline-2"
                        >
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm text-ink group-hover:text-accent-strong">{link.label}</span>
                            {link.description && <span className="text-xs text-ink-faint">{link.description}</span>}
                          </span>
                          <ChevronRight aria-hidden="true" className="mt-0.5 size-4 text-ink-faint" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
