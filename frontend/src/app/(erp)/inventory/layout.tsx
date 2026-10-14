import type { ReactNode } from "react";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return <div className="inventory-module-root relative min-h-full">{children}</div>;
}
