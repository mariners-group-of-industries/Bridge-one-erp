import { AppShell } from "@/components/layout/app-shell";

export default function ErpLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
