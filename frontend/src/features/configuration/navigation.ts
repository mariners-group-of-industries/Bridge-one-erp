import { Settings } from "lucide-react";
import type { NavCard, NavLink, Workspace } from "@/lib/navigation/types";
import { paths } from "./business-config/company-profile/paths";
import { entityMasterDataPaths } from "./entity-master-data/paths";
import { salesConfigPaths } from "./sales-config/paths";
import { gatewaysPaths } from "./gateways/paths";
import { securityPaths } from "./security/paths";
import { systemLogsPaths } from "./system-logs/paths";

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

export const entityMasterData: NavCard = {
  label: "Entity Master Data",
  href: entityMasterDataPaths.root,
  links: [
    {
      label: "Employee",
      href: entityMasterDataPaths.employee,
      description: "Employee Management: search, filter and act on employee records.",
      keywords: ["employee", "staff", "attendance"],
    },
    { label: "Item Profile", href: entityMasterDataPaths.itemProfile, keywords: ["item", "product"] },
    { label: "Customer Profile", href: entityMasterDataPaths.customerProfile, keywords: ["customer", "client"] },
    { label: "Supplier Profile", href: entityMasterDataPaths.supplierProfile, keywords: ["supplier", "vendor"] },
  ],
};

export const salesConfig: NavCard = {
  label: "Sales Config",
  href: salesConfigPaths.root,
  links: [
    { label: "Offer Setup", href: salesConfigPaths.offerSetup, keywords: ["offer", "promotion", "discount", "bonus"] },
    { label: "Customer Price Setup", href: salesConfigPaths.customerPriceSetup, keywords: ["customer price", "price"] },
    { label: "Sales Setup", href: salesConfigPaths.salesSetup, keywords: ["sales", "setup"] },
    { label: "Standard Price Setup", href: salesConfigPaths.standardPriceSetup, keywords: ["standard price", "price"] },
    { label: "Wallet Setup", href: salesConfigPaths.walletSetup, keywords: ["wallet"] },
    { label: "Sales Return Price Setup", href: salesConfigPaths.salesReturn, keywords: ["return", "sales return", "return price"] },
  ],
};

export const identitySecurity: NavCard = {
  label: "Identity & Security",
  href: securityPaths.root,
  links: [
    {
      label: "Approval Setup",
      href: securityPaths.approvalSetup,
      description: "Approval pipelines: super approver and staged approvers per feature.",
      keywords: ["approval", "pipeline", "approver", "workflow"],
    },
    { label: "User Group", href: securityPaths.userGroup, keywords: ["user", "group"] },
    { label: "Permission Group", href: securityPaths.permissionGroup, keywords: ["permission", "role", "access"] },
  ],
};

export const communityGateways: NavCard = {
  label: "Community & Gateways",
  href: gatewaysPaths.root,
  links: [
    {
      label: "API Configuration",
      href: gatewaysPaths.apiConfiguration,
      description: "Generate and revoke API tokens for other systems.",
      keywords: ["api", "token", "integration", "gateway", "expose"],
    },
    {
      label: "Attendance Devices",
      href: gatewaysPaths.attendanceDevices,
      description: "Biometric terminals (ZKTeco) whose punches feed HRM attendance.",
      keywords: ["attendance", "device", "zkteco", "biometric", "fingerprint", "punch"],
    },
  ],
};

export const systemLogs: NavCard = {
  label: "System Logs",
  href: systemLogsPaths.root,
  links: [
    {
      label: "Audit Logs",
      href: systemLogsPaths.auditLogs,
      description: "Who changed what and when.",
      keywords: ["audit", "log", "history", "activity"],
    },
  ],
};

export const configurationWorkspace: Workspace = {
  id: "configuration",
  label: "Configuration",
  icon: Settings,
  href: "/configuration",
  description: "Company setup, business units, offices, warehouses and document terms.",
  status: "active",
  shortcuts: [companyProfile],
  cards: [{ label: "Business Config", links: [companyProfile, businessUnits] }, entityMasterData, salesConfig, identitySecurity, communityGateways, systemLogs],
  routes: [
    {
      pattern: "/configuration/business-config/offices/[officeId]",
      label: "Office",
      parent: businessUnits.href,
    },
  ],
};
