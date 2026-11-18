"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { buttonClasses } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth/session";
import { essPaths } from "@/features/ess/navigation";
import { HomeDashboard } from "./HomeDashboard";

/**
 * Home: the business overview dashboard, for the master account only. Every
 * other login lands on My Dashboard (My Workspace); a login not yet linked to
 * an employee sees there how to get linked.
 */
export function HomeView() {
  const { user } = useSession();
  const router = useRouter();
  const toWorkspace = !user?.isMaster;

  useEffect(() => {
    if (toWorkspace) router.replace(essPaths.dashboard);
  }, [toWorkspace, router]);

  if (toWorkspace) return <PageLoader label="Opening your workspace…" />;

  return (
    <PageContainer full>
      <PageHead
        title="Home"
        subtitle="Business overview from your live data"
        actions={
          user?.employee ? (
            <Link href={essPaths.dashboard} className={buttonClasses("secondary", "md")}>
              <UserRound aria-hidden="true" />
              My Workspace
            </Link>
          ) : undefined
        }
      />
      <HomeDashboard />
    </PageContainer>
  );
}
