const ROOT = "/configuration/entity-master-data";

export const entityMasterDataPaths = {
  root: ROOT,
  employee: `${ROOT}/employee`,
  employeeCreate: `${ROOT}/employee/create`,
  employeeProfile: (id: string) => `${ROOT}/employee/${id}/profile`,
  itemProfile: `${ROOT}/item-profile`,
  itemCreate: `${ROOT}/item-profile/new`,
  itemEdit: (id: string) => `${ROOT}/item-profile/${id}`,
  itemOpeningStock: `${ROOT}/item-profile/opening-stock`,
  customerProfile: `${ROOT}/customer-profile`,
  customerCreate: `${ROOT}/customer-profile/new`,
  customerEdit: (id: string) => `${ROOT}/customer-profile/${id}`,
  supplierProfile: `${ROOT}/supplier-profile`,
  supplierCreate: `${ROOT}/supplier-profile/new`,
  supplierEdit: (id: string) => `${ROOT}/supplier-profile/${id}`,
} as const;
