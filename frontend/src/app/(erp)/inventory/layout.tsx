import type { ReactNode } from "react";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  // While a create form is open (iBOS: its own page), the list behind it is hidden but stays mounted.
  return <div className="inventory-module-root relative min-h-full [&.inv-form-open>:not(.inv-form-page)]:hidden">{children}</div>;
}
