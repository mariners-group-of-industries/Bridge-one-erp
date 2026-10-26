"use client";

import { ArrowLeft, Building2, CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { entityMasterDataPaths } from "../../paths";
import type { ProfileTab } from "../actions/employee-actions";
import type { PersonalInfoDto } from "../schemas/personal-info.schema";
import { personalInfoApi } from "../services/personal-info.api";
import { AcademicInfoTab } from "./AcademicInfoTab";
import { EmploymentHistoryTab } from "./EmploymentHistoryTab";
import { Avatar, StatusBadge } from "./kit";
import { OfficialInfoTab } from "./OfficialInfoTab";
import { PersonalInfoTab } from "./PersonalInfoTab";
import { SalaryInfoTab } from "./SalaryInfoTab";
import { UpdateDocumentTab } from "./UpdateDocumentTab";

const TABS = [
  { id: "personal-info", label: "Personal Info" },
  { id: "official-info", label: "Official Info" },
  { id: "salary-info", label: "Salary" },
  { id: "update-document", label: "Documents" },
  { id: "academic-info", label: "Academic" },
  { id: "employment-history", label: "Employment History" },
] as const satisfies readonly { id: ProfileTab; label: string }[];

const DEFAULT_TAB: ProfileTab = "personal-info";

function ProfileInner({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = TABS.find((tab) => tab.id === rawTab)?.id ?? DEFAULT_TAB;

  // Loaded once here: drives the header and is handed to the Personal Info tab.
  const profile = useResource(`personal-info:${employeeId}`, () => personalInfoApi.getPersonalInfo(employeeId));

  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(entityMasterDataPaths.employee),
    { label: profile.data?.name ?? "Profile", href: entityMasterDataPaths.employeeProfile(employeeId) },
  ];

  const setTab = (tab: ProfileTab) =>
    router.replace(`${entityMasterDataPaths.employeeProfile(employeeId)}?tab=${tab}`, { scroll: false });

  return (
    <PageContainer full>
      <PageHead
        title="Employee Profile"
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={entityMasterDataPaths.employee} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Employees
          </Link>
        }
      />

      {profile.error ? (
        <section className="rounded border border-line bg-surface">
          <ErrorState message={profile.error.message} onRetry={profile.reload} />
        </section>
      ) : !profile.data ? (
        <section className="rounded border border-line bg-surface">
          <LoadingState label="Loading employee…" />
        </section>
      ) : (
        <>
          <ProfileHeader data={profile.data} />
          <Tabs tabs={TABS} value={activeTab} onChange={setTab} label="Profile sections" tone="accent" className="mt-4">
            <div className="pt-4">
              <TabContent
                tab={activeTab}
                employeeId={employeeId}
                profile={profile.data}
                onProfileSaved={(saved) => profile.mutate(() => saved)}
              />
            </div>
          </Tabs>
        </>
      )}
    </PageContainer>
  );
}

function TabContent({
  tab,
  employeeId,
  profile,
  onProfileSaved,
}: {
  tab: ProfileTab;
  employeeId: string;
  profile: PersonalInfoDto;
  onProfileSaved: (saved: PersonalInfoDto) => void;
}) {
  switch (tab) {
    case "personal-info":
      return <PersonalInfoTab employeeId={employeeId} data={profile} onSaved={onProfileSaved} />;
    case "update-document":
      return <UpdateDocumentTab employeeId={employeeId} />;
    case "official-info":
      return <OfficialInfoTab employeeId={employeeId} />;
    case "salary-info":
      return <SalaryInfoTab employeeId={employeeId} />;
    case "academic-info":
      return <AcademicInfoTab employeeId={employeeId} />;
    case "employment-history":
      return <EmploymentHistoryTab employeeId={employeeId} />;
  }
}

/** Identity card at the top of every profile tab. */
function ProfileHeader({ data }: { data: PersonalInfoDto }) {
  const meta: { icon: ReactNode; text: string | null }[] = [
    { icon: <Building2 />, text: [data.designation, data.department].filter(Boolean).join(" · ") || null },
    { icon: <MapPin />, text: data.officeName },
    { icon: <Phone />, text: data.mobile },
    { icon: <Mail />, text: data.email },
  ];

  return (
    <section className="rounded border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={data.name} size="lg" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-ink">{data.name}</h2>
              <StatusBadge active={!data.terminationDate} />
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {meta
                .filter((item) => item.text)
                .map((item) => (
                  <li key={item.text} className="flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:text-ink-faint">
                    {item.icon}
                    {item.text}
                  </li>
                ))}
            </ul>
          </div>
        </div>

        <dl className="grid grid-cols-3 divide-x divide-line rounded border border-line bg-canvas text-center lg:min-w-[22rem]">
          <Fact label="Employee Id" value={data.employeeCode} />
          <Fact label="Attendance Id" value={data.attendanceId ?? "—"} />
          <Fact label="Joined" value={data.joiningDate} icon={<CalendarDays />} />
        </dl>
      </div>
    </section>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="flex items-center justify-center gap-1 text-sm font-semibold text-ink tabular-nums [&_svg]:size-3.5 [&_svg]:text-ink-faint">
        {icon}
        {value}
      </dd>
    </div>
  );
}

export function UpdateProfileView({ employeeId }: { employeeId: string }) {
  return (
    <Suspense>
      <ProfileInner employeeId={employeeId} />
    </Suspense>
  );
}
