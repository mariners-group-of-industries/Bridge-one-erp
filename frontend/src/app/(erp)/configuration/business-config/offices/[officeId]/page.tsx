import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { OfficeFormView } from "@/features/configuration/business-config/company-profile/components/OfficeFormView";

export const metadata: Metadata = { title: "Office" };

export default function OfficePage({ params }: { params: Promise<{ officeId: string }> }) {
  // Params are request-time data under Cache Components, so read them inside Suspense.
  return (
    <Suspense fallback={<LoadingState />}>
      {params.then(({ officeId }) => (
        <OfficeFormView officeId={officeId} />
      ))}
    </Suspense>
  );
}
