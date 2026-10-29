import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { BudgetFormView } from "@/features/sales/targets/components/TargetForms";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function View({ params }: { params: Promise<{ budgetId: string }> }) {
  return <BudgetFormView id={(await params).budgetId} />;
}

export default function Page({ params }: { params: Promise<{ budgetId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <View params={params} />
    </Suspense>
  );
}
