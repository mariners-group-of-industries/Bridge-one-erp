import { Settings } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths } from "./business-config/company-profile/paths";

const companyProfile: NavLink = {
  label: "Company Profile",
  href: paths.companyProfile,
  description: "Company info, business units, offices, warehouses and document terms.",
  keywords: ["company", "organisation", "business unit", "office", "warehouse", "terms"],
};

const businessUnits: NavLink = {
  label: "Business Units",
  href: "/configuration/business-config/business-units",
};

export const configurationWorkspace: Workspace = {
  id: "configuration",
  label: "Configuration",
  icon: Settings,
  href: "/configuration",
  description: "Company setup, business units, offices, warehouses and document terms.",
  status: "active",
  shortcuts: [companyProfile],
  cards: [{ label: "Business Config", links: [companyProfile, businessUnits] }],
  routes: [
    {
      pattern: "/configuration/business-config/offices/[officeId]",
      label: "Office",
      parent: businessUnits.href,
    },
  ],
};
