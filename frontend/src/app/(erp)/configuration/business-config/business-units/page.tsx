import type { Metadata } from "next";
import { BusinessUnitListView } from "@/features/configuration/business-config/company-profile/components/BusinessUnitListView";

export const metadata: Metadata = { title: "Business Units" };

export default function BusinessUnitsPage() {
  return <BusinessUnitListView />;
}
