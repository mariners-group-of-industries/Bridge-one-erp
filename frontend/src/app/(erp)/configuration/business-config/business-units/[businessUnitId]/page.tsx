import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { BusinessUnitFormView } from "@/features/configuration/business-config/company-profile/components/BusinessUnitFormView";

export const metadata: Metadata = { title: "Business Unit" };

export default function BusinessUnitPage({
  params,
}: {
  params: Promise<{ businessUnitId: string }>;
}) {
  // Params are request-time data under Cache Components, so read them inside Suspense.
  return (
    <Suspense fallback={<LoadingState />}>
      {params.then(({ businessUnitId }) => (
        <BusinessUnitFormView businessUnitId={businessUnitId} />
      ))}
    </Suspense>
  );
}
