"use client";

import {
  BookOpen,
  Briefcase,
  Clock,
  FileText,
  User,
  Wallet,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { cn } from "@/lib/cn";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { entityMasterDataPaths } from "../../paths";
import type { ProfileTab } from "../actions/employee-actions";
import { OfficialInfoTab } from "./OfficialInfoTab";
import { PersonalInfoTab } from "./PersonalInfoTab";
import { SalaryInfoTab } from "./SalaryInfoTab";
import { UpdateDocumentTab } from "./UpdateDocumentTab";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: ProfileTab; label: string; icon: React.ElementType }[] = [
  { id: "personal-info",       label: "Personal Info",       icon: User },
  { id: "update-document",     label: "Update Document",     icon: FileText },
  { id: "official-info",       label: "Official Info",       icon: Briefcase },
  { id: "salary-info",         label: "Salary Info",         icon: Wallet },
  { id: "academic-info",       label: "Academic Info",       icon: BookOpen },
  { id: "employment-history",  label: "Employment History",  icon: Clock },
];

const DEFAULT_TAB: ProfileTab = "personal-info";

// ─── Tab placeholder ──────────────────────────────────────────────────────────

function TabPlaceholder({ tab }: { tab: ProfileTab }) {
  const found = TABS.find((t) => t.id === tab)!;
  const Icon = found.icon;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
        <Icon className="size-7" />
      </span>
      <p className="text-base font-semibold text-ink">{found.label}</p>
      <p className="max-w-xs text-sm text-ink-faint">
        Fields for this section will be added soon. Come back later.
      </p>
    </div>
  );
}

function TabContent({ tab, employeeId }: { tab: ProfileTab; employeeId: string }) {
  if (tab === "personal-info")   return <PersonalInfoTab employeeId={employeeId} />;
  if (tab === "update-document") return <UpdateDocumentTab employeeId={employeeId} />;
  if (tab === "official-info")   return <OfficialInfoTab employeeId={employeeId} />;
  if (tab === "salary-info")     return <SalaryInfoTab employeeId={employeeId} />;
  return <TabPlaceholder tab={tab} />;
}

// ─── Inner view (uses useSearchParams) ───────────────────────────────────────

function ProfileInner({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") as ProfileTab | null;
  const activeTab: ProfileTab = TABS.some((t) => t.id === rawTab) ? rawTab! : DEFAULT_TAB;

  const breadcrumbs = entityMasterDataBreadcrumbs(entityMasterDataPaths.employee);

  const setTab = (tab: ProfileTab) => {
    router.replace(
      `${entityMasterDataPaths.employeeProfile(employeeId)}?tab=${tab}`,
    );
  };

  return (
    <PageContainer full>
      <PageHead
        title="Update Profile"
        subtitle={`Employee ID: ${employeeId}`}
        breadcrumbs={[
          ...breadcrumbs,
          { label: "Update Profile", href: entityMasterDataPaths.employeeProfile(employeeId) },
        ]}
      />

      {/* Tab bar */}
      <div className="mb-4 flex overflow-x-auto rounded-xl border border-line bg-surface">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={cn(
                "flex flex-1 min-w-max items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2",
                active
                  ? "border-accent-strong bg-accent-soft text-accent-strong"
                  : "border-transparent text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <TabContent tab={activeTab} employeeId={employeeId} />
    </PageContainer>
  );
}

// ─── Export (Suspense boundary for useSearchParams) ───────────────────────────

export function UpdateProfileView({ employeeId }: { employeeId: string }) {
  return (
    <Suspense>
      <ProfileInner employeeId={employeeId} />
    </Suspense>
  );
}
