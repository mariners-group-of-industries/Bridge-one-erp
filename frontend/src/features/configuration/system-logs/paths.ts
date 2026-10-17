const ROOT = "/configuration/system-logs";

export const systemLogsPaths = {
  root: ROOT,
  auditLogs: `${ROOT}/audit-logs`,
} as const;
