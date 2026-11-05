import { Construction } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Card, EmptyState } from "@/components/ui/section";
import type { NavLink } from "@/lib/navigation/types";

/** Shown on an RTM page until it is built. */
export function RtmPagePlaceholder({ page }: { page: NavLink }) {
  return (
    <PageContainer full>
      <PageHead title={page.label} subtitle={page.description} />
      <Card>
        <EmptyState icon={<Construction />} title={`${page.label} is being built`} subtitle="This RTM page is coming soon." />
      </Card>
    </PageContainer>
  );
}
