import React, { Suspense } from "react";
import { PaymentByGrnView } from "@/features/purchase/components/PaymentByGrnView";

export const instant = false;

export default function PaymentByGrnPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-faint">Loading Payment By GRN...</div>}>
      <PaymentByGrnView />
    </Suspense>
  );
}

