import { AppShell } from "@/components/layout/AppShell";

export default function PurchaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
