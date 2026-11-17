"use client";

import { Bell, CalendarDays, CheckCheck, ClipboardCheck, FileText, Megaphone, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { PageContainer, PageHead } from "@/components/layout/page";
import { EmptyBlock, Panel } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import { fmtDate, fmtDateTime } from "./ess-ui";

const ICON = { leave: FileText, movement: FileText, attendance: ClipboardCheck, payslip: ReceiptText, calendar: CalendarDays, general: Bell } as Record<string, typeof Bell>;

/**
 * Notifications belong to the login, so this page also works for users who are
 * not linked to an employee (they simply have no notices).
 */
export function NotificationsView() {
  const toast = useToast();
  const data = useResource("ess-notifications", () => essApi.notifications(100), { refreshOnFocus: true });
  const [tab, setTab] = useState<"inbox" | "notices">("inbox");
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);
    try {
      await essApi.markRead();
      data.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <PageHead
        title="Notifications"
        breadcrumbs={[{ label: "My Workspace", href: essPaths.dashboard }, { label: "Notifications", href: "#" }]}
        actions={
          !!data.data?.unread && (
            <Button onClick={() => void markAll()} loading={busy}>
              <CheckCheck aria-hidden="true" />
              Mark all as read
            </Button>
          )
        }
      />
      <Panel flush>
        <Tabs
          label="Notifications"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "inbox", label: "Inbox", badge: data.data?.unread || undefined },
            { id: "notices", label: "Notice Board", badge: data.data?.notices.length || undefined },
          ]}
        >
          {data.error ? (
            <ErrorState message={data.error.message} onRetry={data.reload} />
          ) : !data.data ? (
            <LoadingState label="Loading notifications…" />
          ) : tab === "inbox" ? (
            data.data.items.length === 0 ? (
              <div className="p-4">
                <EmptyBlock icon={<Bell />} title="No notifications yet">
                  Decisions on your leave and corrections, published payslips and calendar changes appear here.
                </EmptyBlock>
              </div>
            ) : (
              <ul>
                {data.data.items.map((n) => {
                  const Icon = ICON[n.kind] ?? Bell;
                  const body = (
                    <>
                      <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border [&_svg]:size-4", n.read ? "border-line text-ink-faint" : "border-accent-line bg-accent-soft text-accent-strong dark:text-accent")}>
                        <Icon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[13px]", n.read ? "text-ink-muted" : "font-semibold text-ink")}>
                          {n.title}
                          {!n.read && <span className="sr-only"> (unread)</span>}
                        </span>
                        {n.body && <span className="block text-xs text-ink-muted">{n.body}</span>}
                      </span>
                      <time dateTime={n.createdAt} className="shrink-0 text-[11px] text-ink-faint">
                        {fmtDateTime(n.createdAt)}
                      </time>
                    </>
                  );
                  const open = () => {
                    if (!n.read) void essApi.markRead(n.id).then(data.reload, () => undefined);
                  };
                  return (
                    <li key={n.id} className="border-b border-line last:border-b-0">
                      {n.link ? (
                        <Link href={n.link} onClick={open} className="flex items-start gap-3 px-5 py-3 hover:bg-control focus-visible:outline-2">
                          {body}
                        </Link>
                      ) : (
                        <button type="button" onClick={open} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-control focus-visible:outline-2">
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : data.data.notices.length === 0 ? (
            <div className="p-4">
              <EmptyBlock icon={<Megaphone />} title="No notices right now" />
            </div>
          ) : (
            <ul>
              {data.data.notices.map((n) => (
                <li key={n.id} className="flex flex-col gap-1 border-b border-line px-5 py-4 last:border-b-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {n.title}
                    {n.priority !== "Normal" && <Badge variant={n.priority === "Urgent" ? "danger" : "warning"}>{n.priority}</Badge>}
                  </p>
                  <p className="text-[13px] whitespace-pre-line text-ink">{n.message}</p>
                  <p className="text-[11px] text-ink-faint">
                    Published {fmtDate(n.publishedOn)}
                    {n.expiresOn ? ` · until ${fmtDate(n.expiresOn)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Tabs>
      </Panel>
    </PageContainer>
  );
}
