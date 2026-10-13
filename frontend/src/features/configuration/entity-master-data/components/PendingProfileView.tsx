import { Construction } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Card, EmptyState } from "@/components/ui/section";
import { entityMasterDataBreadcrumbs } from "../breadcrumbs";

export function PendingProfileView({ title, path }: { title: string; path: string }) {
  return (
    <PageContainer>
      <PageHead title={title} breadcrumbs={entityMasterDataBreadcrumbs(path)} />
      <Card>
        <EmptyState icon={<Construction />} title={`${title} is not available yet`}>
          This page will be built once its fields and rules are defined.
        </EmptyState>
      </Card>
    </PageContainer>
  );
}
