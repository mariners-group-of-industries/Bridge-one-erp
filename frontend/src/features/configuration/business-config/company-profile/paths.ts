const BASE = "/configuration/business-config";

/** URLs of the business configuration pages (keep in sync with src/app/(erp)/configuration). */
export const paths = {
  companyProfile: `${BASE}/company-profile`,
  businessUnits: `${BASE}/business-units`,
  businessUnit: (id: string) => `${BASE}/business-units/${id}`,
  office: (id: string) => `${BASE}/offices/${id}`,
};

/** Route patterns for breadcrumbs. */
export const patterns = {
  businessUnit: `${BASE}/business-units/[businessUnitId]`,
  office: `${BASE}/offices/[officeId]`,
};
