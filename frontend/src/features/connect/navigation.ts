import { MessageSquareText } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { connectPaths } from "./paths";

export const chatLink: NavLink = {
  label: "BRG Connect Chat",
  href: connectPaths.chat,
  description: "Enterprise real-time chat, channels, direct messages, and embedded ERP cards.",
  keywords: ["connect", "chat", "messages", "realtime", "channels", "conversations"],
};

export const directoryLink: NavLink = {
  label: "Employee Directory",
  href: connectPaths.directory,
  description: "Company-wide employee directory lookup by department, role, and branch with 1-click chat.",
  keywords: ["directory", "employees", "team", "colleagues", "staff", "contacts"],
};

export const callsLink: NavLink = {
  label: "Calls & Meetings",
  href: connectPaths.calls,
  description: "Audio/Video call history, active meetings, and WebRTC P2P communication logs.",
  keywords: ["calls", "webrtc", "video", "audio", "meetings", "conferencing"],
};

export const tasksLink: NavLink = {
  label: "Tasks",
  href: connectPaths.tasks,
  description: "Daily task center: My Tasks, Team Tasks, Approvals, and Progress Updates.",
  keywords: ["tasks", "my tasks", "todo", "progress", "work", "approvals"],
};

export const assignTaskLink: NavLink = {
  label: "Assign Task",
  href: connectPaths.assignTask,
  description: "Create and delegate tasks across companies, departments, and projects with SLA verification.",
  keywords: ["assign task", "new task", "delegate", "create task", "assignment"],
};

export const monitoringLink: NavLink = {
  label: "Performance & Monitoring",
  href: connectPaths.monitoring,
  description: "MD & Executive Dashboard: Golden Reports, Employee KPI scores, and Delay alerts.",
  keywords: ["monitoring", "performance", "kpi", "executive", "md dashboard", "golden reports"],
};

// Aliases kept for breadcrumb and search registry backwards-compatibility
export const myDashboardLink: NavLink = tasksLink;
export const myTasksLink: NavLink = tasksLink;
export const teamTasksLink: NavLink = tasksLink;
export const allTasksLink: NavLink = tasksLink;
export const dailyReportLink: NavLink = tasksLink;
export const pendingOverdueLink: NavLink = tasksLink;
export const taskApprovalLink: NavLink = tasksLink;
export const recurringTasksLink: NavLink = tasksLink;
export const employeePerformanceLink: NavLink = monitoringLink;
export const managementDashboardLink: NavLink = monitoringLink;
export const taskSettingsLink: NavLink = monitoringLink;

export const connectSidebarLinks: readonly NavLink[] = [
  chatLink,
  directoryLink,
  callsLink,
];

export const connectWorkspace: Workspace = {
  id: "connect",
  label: "BRG Connect",
  icon: MessageSquareText,
  href: connectPaths.chat,
  description: "Integrated enterprise team messaging, channels, ERP workflow cards, and WebRTC audio/video calling.",
  status: "active",
  shortcuts: [chatLink, directoryLink, callsLink],
  sidebarLinks: [chatLink, directoryLink, callsLink],
  cards: [
    {
      label: "",
      links: [chatLink, directoryLink, callsLink],
    },
  ],
};
