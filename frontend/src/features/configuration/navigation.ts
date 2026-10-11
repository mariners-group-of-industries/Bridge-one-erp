import { Settings } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths, patterns } from "./business-config/company-profile/paths";

const companyProfile: NavLink = {
  label: "Company Profile",
  href: paths.companyProfile,
  description: "Legal name, address and contact email of the company.",
  keywords: ["company", "organisation", "settings"],
};

const businessUnits: NavLink = {
  label: "Business Units",
  href: paths.businessUnits,
  description: "Business units with their offices, warehouses and document terms.",
  keywords: ["business unit", "branch", "office", "warehouse", "terms", "conditions"],
};

export const configurationWorkspace: Workspace = {
  id: "configuration",
  label: "Configuration",
  icon: Settings,
  href: "/configuration",
  description: "Company setup, business units, offices, warehouses and document terms.",
  status: "active",
  shortcuts: [companyProfile, businessUnits],
  cards: [{ label: "Business Configuration", links: [companyProfile, businessUnits] }],
  routes: [
    { pattern: patterns.businessUnit, label: "Business Unit", parent: businessUnits.href },
    { pattern: patterns.office, label: "Office", parent: businessUnits.href },
  ],
};
