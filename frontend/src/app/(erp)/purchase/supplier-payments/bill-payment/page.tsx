import { Suspense } from "react";
import { BillPaymentView } from "@/features/purchase/components/BillPaymentView";

// Rendered only after the session loads in the browser; instant-navigation validation cannot run.
export const instant = false;

export default function BillPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-ink-muted">Loading Bill Payment...</div>}>
      <BillPaymentView />
    </Suspense>
  );
}
