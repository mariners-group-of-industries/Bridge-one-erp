import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHead } from "@/components/layout/page";
import { HomeDashboard } from "@/features/home/HomeDashboard";
import { workspaces } from "@/lib/navigation/registry";

export const instant = false;

export default function HomePage() {
  const active = workspaces.filter((workspace) => workspace.status === "active");
  const shortcuts = active.flatMap((workspace) =>
    (workspace.shortcuts ?? []).map((link) => ({ ...link, module: workspace.label })),
  );

  return (
    <PageContainer full>
      <PageHead title="Home" subtitle="Business overview from your live data" />
      <div className="flex flex-col gap-8">
        <HomeDashboard />

        <section aria-labelledby="home-shortcuts" className="flex flex-col gap-3">
          <h2 id="home-shortcuts" className="text-xs font-bold tracking-wide text-ink uppercase">
            Your Shortcuts
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group flex h-full items-center justify-between gap-2 rounded border border-line bg-surface px-4 py-3 transition-shadow hover:shadow-sm focus-visible:outline-2"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-ink">{link.label}</span>
                    <span className="text-xs text-ink-faint">{link.module}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 text-ink-faint group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-modules" className="flex flex-col gap-3">
          <h2 id="home-modules" className="text-xs font-bold tracking-wide text-ink uppercase">
            Modules
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => {
              const Icon = workspace.icon;
              const body = (
                <>
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded bg-control text-ink-muted [&_svg]:size-5"
                  >
                    <Icon />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      {workspace.label}
                      {workspace.status === "planned" && (
                        <span className="rounded bg-control px-1 text-[10px] font-normal text-ink-faint uppercase">
                          Coming soon
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-ink-faint">{workspace.description}</span>
                  </span>
                </>
              );
              return (
                <li key={workspace.id}>
                  {workspace.status === "active" ? (
                    <Link
                      href={workspace.href}
                      target={workspace.href.startsWith("http") ? "_blank" : undefined}
                      rel={workspace.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex h-full gap-3 rounded border border-line bg-surface p-4 transition-shadow hover:shadow-sm focus-visible:outline-2"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex h-full gap-3 rounded border border-dashed border-line-strong p-4 opacity-70">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}
