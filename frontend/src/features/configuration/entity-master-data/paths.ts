const ROOT = "/configuration/entity-master-data";

export const entityMasterDataPaths = {
  root: ROOT,
  employee: `${ROOT}/employee`,
  employeeCreate: `${ROOT}/employee/create`,
  employeeProfile: (id: string) => `${ROOT}/employee/${id}/profile`,
  itemProfile: `${ROOT}/item-profile`,
  customerProfile: `${ROOT}/customer-profile`,
  supplierProfile: `${ROOT}/supplier-profile`,
} as const;
