export const connectPaths = {
  chat: "/connect",
  directory: "/connect/directory",
  calls: "/connect/calls",
  docs: "/connect/docs",
  // Simple 3-Menu Task Architecture
  tasks: "/connect/tasks",
  assignTask: "/connect/tasks/assign",
  monitoring: "/connect/tasks/executive",
  // Backwards-compatible aliases
  tasksRoot: "/connect/tasks",
  myDashboard: "/connect/tasks",
  myTasks: "/connect/tasks?tab=my-tasks",
  teamTasks: "/connect/tasks?tab=team",
  allTasks: "/connect/tasks?tab=all",
  dailyReport: "/connect/tasks?tab=daily-report",
  pendingOverdue: "/connect/tasks?tab=overdue",
  taskApproval: "/connect/tasks?tab=approvals",
  recurringTasks: "/connect/tasks?tab=recurring",
  employeePerformance: "/connect/tasks/executive?tab=kpi",
  managementDashboard: "/connect/tasks/executive",
  taskSettings: "/connect/tasks/executive?tab=settings",
} as const;
