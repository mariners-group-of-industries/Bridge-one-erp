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
 * Home: the business overview dashboard. An employee whose login opens no
 * module (an ordinary employee) goes straight to their own workspace instead.
 */
export function HomeView() {
  const { user, workspaces } = useSession();
  const router = useRouter();
  const onlySelfService = !!user?.employee && !workspaces.some((w) => w.status === "active");

  useEffect(() => {
    if (onlySelfService) router.replace(essPaths.dashboard);
  }, [onlySelfService, router]);

  if (onlySelfService) return <PageLoader label="Opening your workspace…" />;

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
