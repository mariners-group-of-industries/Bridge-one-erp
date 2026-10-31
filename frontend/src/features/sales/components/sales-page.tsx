import { Construction } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Card } from "@/components/ui/section";
import { EmptyState } from "@/features/sales/components/EmptyState";
import type { NavLink } from "@/lib/navigation/types";

/** Placeholder for a sales page that is registered in the menu but not built yet. */
export function SalesPage({ link }: { link: NavLink }) {
  return (
    <PageContainer>
      <PageHead title={link.label} subtitle={link.description} />
      <Card>
        <EmptyState title={`${link.label} is coming soon`} icon={<Construction />}>
          This page has not been built yet.
        </EmptyState>
      </Card>
    </PageContainer>
  );
}
