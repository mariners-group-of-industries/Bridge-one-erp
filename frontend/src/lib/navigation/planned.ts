import { Banknote, Factory, Handshake, Route, Users } from "lucide-react";
import type { Workspace } from "./types";

/**
 * Modules on the roadmap. They appear greyed-out in the sidebar. When you start
 * one, move its entry into `src/features/<module>/navigation.ts`, set
 * `status: "active"` and register it in `registry.ts` in place of this entry.
 */
const planned = (id: string, label: string, icon: Workspace["icon"], description: string): Workspace => ({
  id,
  label,
  icon,
  href: `/${id}`,
  description,
  status: "planned",
});

export const productionWorkspace = planned("production", "Production", Factory, "Bills of materials, work orders and production output.");
export const payrollWorkspace = planned("payroll", "Payroll", Banknote, "Salary processing, allowances, deductions and payslips.");
export const rtmWorkspace = planned("rtm", "RTM", Route, "Route to market: distributors, routes, outlets and field force.");
export const crmWorkspace = planned("crm", "CRM", Handshake, "Leads, opportunities, customer follow-ups and campaigns.");
export const hrWorkspace = planned("hr", "HR", Users, "Employees, attendance, leave and HR operations.");
