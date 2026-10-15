const ROOT = "/configuration/security";

export const securityPaths = {
  root: ROOT,
  approvalSetup: `${ROOT}/approval-setup`,
  approvalNew: `${ROOT}/approval-setup/new`,
  approvalEdit: (id: string) => `${ROOT}/approval-setup/${id}`,
  userGroup: `${ROOT}/user-group`,
  userGroupNew: `${ROOT}/user-group/new`,
  userGroupEdit: (id: string) => `${ROOT}/user-group/${id}`,
  permissionGroup: `${ROOT}/permission-group`,
  permissionGroupNew: `${ROOT}/permission-group/new`,
  permissionGroupEdit: (id: string) => `${ROOT}/permission-group/${id}`,
} as const;
