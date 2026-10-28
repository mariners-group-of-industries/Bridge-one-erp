import type { Metadata } from "next";
import { PolicySettingsView } from "@/features/hrm/governance/components/GovernanceViews";

export const instant = false;

export const metadata: Metadata = { title: "Settings / Policies" };

export default function PolicySettingsPage() {
  return <PolicySettingsView />;
}
