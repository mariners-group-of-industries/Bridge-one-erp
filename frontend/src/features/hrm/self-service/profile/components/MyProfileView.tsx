"use client";

import { Eye, UserRound } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { apiRequest } from "@/lib/api/client";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmployeeProfileDialog } from "@/features/configuration/entity-master-data/employee/components/EmployeeProfileDialog";
import { EmptyBlock } from "@/features/configuration/entity-master-data/employee/components/kit";
import type { EmployeeActionTarget } from "@/features/configuration/entity-master-data/employee/actions/employee-actions";
import { hrmPaths } from "../../../paths";
import type { ProfileList } from "../types";

const TABS = [{ id: "basic", label: "Basic Information" }] as const;
const HEADERS = ["SL", "Action", "Code", "Employee Name", "Designation", "Department", "Employee Type", "Date Of Joining", "Supervisor"];
const date = (iso: string) => iso.split("-").reverse().join("/");
const dash = (value: string | null) => value || <span className="text-ink-faint">—</span>;

export function MyProfileView() {
  const profile = useResource("hrm-my-profile", () => apiRequest<ProfileList>("/api/hrm/self-service/profile"));
  const shown = profile.data;
  const [viewing, setViewing] = useState<EmployeeActionTarget | null>(null);

  return (
    <PageContainer full>
      <PageHead title="Profile" subtitle="Your employee information." breadcrumbs={resolveBreadcrumbs(hrmPaths.myProfile).slice(1)} />

      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value="basic" onChange={() => undefined} label="Profile sections">
          {profile.error ? (
            <ErrorState message={profile.error.message} onRetry={profile.reload} />
          ) : !shown ? (
            <LoadingState label="Loading profile…" />
          ) : shown.rows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock icon={<UserRound />} title="No employee record is linked to your account">
                Ask HR to link your login to your employee record (Employee › ERP Access).
              </EmptyBlock>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-grid w-full min-w-max">
                <thead>
                  <tr>
                    {HEADERS.map((h) => (
                      <th key={h} scope="col" className="px-2.5 py-2 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="w-12 px-2.5 py-2 text-right text-ink-faint tabular-nums">{index + 1}</td>
                      <td className="w-16 px-1.5 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-accent-strong"
                          aria-label={`View profile of ${row.name}`}
                          title="View profile"
                          onClick={() => setViewing({ employeeId: row.id, employeeCode: row.code, name: row.name })}
                        >
                          <Eye />
                        </Button>
                      </td>
                      <td className="px-2.5 py-2 font-medium whitespace-nowrap tabular-nums">{row.code}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{row.name}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{dash(row.designation)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{dash(row.department)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{dash(row.employeeType)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">{date(row.joiningDate)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">{dash(row.supervisor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs>
      </section>

      <EmployeeProfileDialog employee={viewing} onClose={() => setViewing(null)} />
    </PageContainer>
  );
}
