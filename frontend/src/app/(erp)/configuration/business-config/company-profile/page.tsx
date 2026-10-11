import type { Metadata } from "next";
import { CompanyProfileView } from "@/features/configuration/business-config/company-profile/components/CompanyProfileView";

export const metadata: Metadata = { title: "Company Profile" };

export default function CompanyProfilePage() {
  return <CompanyProfileView />;
}
