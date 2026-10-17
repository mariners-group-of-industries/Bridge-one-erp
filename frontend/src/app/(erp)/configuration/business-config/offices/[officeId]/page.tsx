import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { OfficeFormView } from "@/features/configuration/business-config/company-profile/components/OfficeFormView";

export const metadata: Metadata = { title: "Office" };

export default async function OfficePage({ params }: { params: Promise<{ officeId: string }> }) {
  const { officeId } = await params;
  return (
    <Suspense fallback={<LoadingState />}>
      <OfficeFormView officeId={officeId} />
    </Suspense>
  );
}
