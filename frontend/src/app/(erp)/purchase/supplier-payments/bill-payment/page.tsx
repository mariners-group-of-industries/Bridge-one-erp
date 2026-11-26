import { Suspense } from "react";
import { BillPaymentView } from "@/features/purchase/components/BillPaymentView";

export default function BillPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-ink-muted">Loading Bill Payment...</div>}>
      <BillPaymentView />
    </Suspense>
  );
}
