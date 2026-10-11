import { AppShell } from "@/components/layout/app-shell";

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
