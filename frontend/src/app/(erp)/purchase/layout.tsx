import { Suspense, type ReactNode } from "react";

export default function PurchaseLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-8 text-sm text-ink-faint">Loading...</div>}>{children}</Suspense>;
}
