"use client";

import { PageContainer, PageHead } from "@/components/layout/page";
import { HomeDashboard } from "./HomeDashboard";

/** Home: the business overview dashboard. */
export function HomeView() {
  return (
    <PageContainer full>
      <PageHead title="Home" subtitle="Business overview from your live data" />
      <HomeDashboard />
    </PageContainer>
  );
}
