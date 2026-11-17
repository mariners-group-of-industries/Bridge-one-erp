import type { Metadata } from "next";
import { DashboardView } from "@/features/ess/components/DashboardView";

export const instant = false;

export const metadata: Metadata = { title: "My Dashboard" };

export default function EmployeeDashboardPage() {
  return <DashboardView />;
}
