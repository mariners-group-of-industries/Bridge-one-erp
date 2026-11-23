"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { Notice } from "@/features/configuration/entity-master-data/employee/components/kit";
import { hrmPaths } from "../../../paths";
import { leaveMovementApi } from "../services/leave-movement.api";
import { AttendanceTab } from "./AttendanceTab";
import { LeaveApplicationDialog } from "./LeaveApplicationDialog";
import { LeaveTab } from "./LeaveTab";
import { MovementTab } from "./MovementTab";

const TABS = [
  { id: "leave", label: "Leave" },
  { id: "movement", label: "Movement" },
  { id: "attendance", label: "Attendance" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function LeaveMovementView() {
  const [tab, setTab] = useState<TabId>("leave");
  const options = useResource("leave-movement-options", leaveMovementApi.options);
  // Bumped after a decision in the notification dialog, so the leave list reloads.
  const [decided, setDecided] = useState(0);

  return (
    <PageContainer full>
      <PageHead
        title="Leave & Movement"
        subtitle={options.data?.canManage ? "HR view: apply for any employee, and approve or reject applications." : "Apply for leave or movement, ask for an attendance change, and follow the approval."}
        breadcrumbs={resolveBreadcrumbs(hrmPaths.leaveMovement).slice(1)}
      />
      {options.error ? (
        <ErrorState message={options.error.message} onRetry={options.reload} />
      ) : !options.data ? (
        <LoadingState label="Loading…" />
      ) : (
        <div className="flex flex-col gap-3">
          {!options.data.self && !options.data.canManage && (
            <Notice tone="error">No employee record is linked to your account. Ask HR to link your login to your employee record (Employee › ERP Access).</Notice>
          )}
          <section className="rounded border border-line bg-surface shadow-xs">
            <Tabs tabs={TABS} value={tab} onChange={setTab} label="Leave and movement">
              {tab === "leave" ? <LeaveTab options={options.data} refresh={decided} /> : tab === "movement" ? <MovementTab options={options.data} /> : <AttendanceTab options={options.data} />}
            </Tabs>
          </section>
          {/* ?leave=<id> (an approver's notification) opens that application. */}
          <Suspense fallback={null}>
            <LeaveLinkWatcher onOpen={() => setTab("leave")} />
            <LeaveApplicationDialog onDecided={() => setDecided((n) => n + 1)} />
          </Suspense>
        </div>
      )}
    </PageContainer>
  );
}

/** Shows the Leave tab when a notification link opens an application. */
function LeaveLinkWatcher({ onOpen }: { onOpen: () => void }) {
  const id = useSearchParams().get("leave");
  useEffect(() => {
    if (id) onOpen();
  }, [id, onOpen]);
  return null;
}
