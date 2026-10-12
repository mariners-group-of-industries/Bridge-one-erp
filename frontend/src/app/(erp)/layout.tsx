import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Desk shell (navbar, sidebar, toasts) around every ERP page. */
export default function ErpLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
