import {
  Briefcase,
  CalendarClock,
  IdCard,
  KeyRound,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { ActionPlaceholder } from "./ActionPlaceholder";

export interface EmployeeActionTarget {
  employeeId: string;
  employeeCode: string;
  name: string;
}

export type EmployeeActionId =
  | "profile-view"
  | "personal-information"
  | "official-information"
  | "salary-information"
  | "update-leave-balance"
  | "permissions"
  | "permission-groups";

/** Tab key on the profile page this action opens. Undefined = opens a panel instead. */
export type ProfileTab =
  | "personal-info"
  | "update-document"
  | "official-info"
  | "salary-info"
  | "academic-info"
  | "employment-history";

export interface EmployeeActionPanelProps {
  action: EmployeeActionDefinition;
  employee: EmployeeActionTarget;
}

export interface EmployeeActionDefinition {
  id: EmployeeActionId;
  label: string;
  icon: LucideIcon;
  /** If set, clicking navigates to the profile page at this tab. */
  profileTab?: ProfileTab;
  Panel: ComponentType<EmployeeActionPanelProps>;
}

const profileView: EmployeeActionDefinition        = { id: "profile-view",        label: "Profile View",        icon: UserRound,                                               Panel: ActionPlaceholder };
const personalInformation: EmployeeActionDefinition = { id: "personal-information", label: "Personal Information", icon: IdCard,       profileTab: "personal-info",       Panel: ActionPlaceholder };
const officialInformation: EmployeeActionDefinition = { id: "official-information", label: "Official Information", icon: Briefcase,    profileTab: "official-info",       Panel: ActionPlaceholder };
const salaryInformation: EmployeeActionDefinition   = { id: "salary-information",   label: "Salary Information",   icon: Wallet,       profileTab: "salary-info",         Panel: ActionPlaceholder };
const updateLeaveBalance: EmployeeActionDefinition  = { id: "update-leave-balance", label: "Update Leave Balance", icon: CalendarClock,                                   Panel: ActionPlaceholder };
const permissions: EmployeeActionDefinition         = { id: "permissions",          label: "Permissions",          icon: KeyRound,                                        Panel: ActionPlaceholder };
const permissionGroups: EmployeeActionDefinition    = { id: "permission-groups",    label: "Permission Groups",    icon: Users,                                           Panel: ActionPlaceholder };

export const EMPLOYEE_ACTIONS: readonly EmployeeActionDefinition[] = [
  profileView,
  personalInformation,
  officialInformation,
  salaryInformation,
  updateLeaveBalance,
  permissions,
  permissionGroups,
];
