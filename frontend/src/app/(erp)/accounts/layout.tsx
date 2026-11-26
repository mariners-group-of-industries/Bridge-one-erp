import type { ReactNode } from "react";
import { ToastContainer } from "@/components/purchase/Toast";

export default function AccountsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="accounts-module-root relative min-h-full">
      {children}
      <ToastContainer />
    </div>
  );
}
