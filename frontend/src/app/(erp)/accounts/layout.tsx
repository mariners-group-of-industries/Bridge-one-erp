import type { ReactNode } from "react";

export default function AccountsLayout({ children }: { children: ReactNode }) {
  return <div className="accounts-module-root relative min-h-full">{children}</div>;
}
