import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { BusinessUnitFormView } from "@/features/configuration/business-config/company-profile/components/BusinessUnitFormView";

export const metadata: Metadata = { title: "Business Unit" };

// Rendered only after the session loads in the browser; instant-navigation validation cannot run.
export const instant = false;

export default async function BusinessUnitPage({
  params,
}: {
  params: Promise<{ businessUnitId: string }>;
}) {
  const { businessUnitId } = await params;
  return (
    <Suspense fallback={<LoadingState />}>
      <BusinessUnitFormView businessUnitId={businessUnitId} />
    </Suspense>
  );
}
