import { Suspense, type ReactNode } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastContainer } from "@/components/purchase/Toast";

export default function PurchaseLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <Suspense fallback={<div className="p-8 text-xs text-slate-400">Loading procurement workspace...</div>}>
        <div className="purchase-module-root relative">
          {children}
          <ToastContainer />
        </div>
      </Suspense>
    </QueryProvider>
  );
}
