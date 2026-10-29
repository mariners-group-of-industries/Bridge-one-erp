"use client";

import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { Notice } from "@/features/configuration/entity-master-data/employee/components/kit";
import { hrmPaths } from "../../../paths";
import { leaveMovementApi } from "../services/leave-movement.api";
import { LeaveTab } from "./LeaveTab";
import { MovementTab } from "./MovementTab";

const TABS = [
  { id: "leave", label: "Leave" },
  { id: "movement", label: "Movement" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function LeaveMovementView() {
  const [tab, setTab] = useState<TabId>("leave");
  const options = useResource("leave-movement-options", leaveMovementApi.options);

  return (
    <PageContainer full>
      <PageHead
        title="Leave & Movement"
        subtitle={options.data?.canManage ? "HR view: apply for any employee, and approve or reject applications." : "Apply for leave or movement and follow the approval."}
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
              {tab === "leave" ? <LeaveTab options={options.data} /> : <MovementTab options={options.data} />}
            </Tabs>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
