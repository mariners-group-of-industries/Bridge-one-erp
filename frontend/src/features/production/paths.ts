const BASE = "/production";

/** URLs of the production pages (keep in sync with src/app/(erp)/production). */
export const paths = {
  workspace: BASE,
  dashboard: `${BASE}/dashboard`,
  workCenters: `${BASE}/work-centers`,
  newWorkCenter: `${BASE}/work-centers/new`,
  editWorkCenter: (id: string) => `${BASE}/work-centers/${id}/edit`,
  billOfMaterials: `${BASE}/bill-of-materials`,
  orders: `${BASE}/orders`,
  entries: `${BASE}/entries`,
  reports: `${BASE}/reports`,
};

/** Route patterns for breadcrumbs. */
export const patterns = {
  newWorkCenter: `${BASE}/work-centers/new`,
  editWorkCenter: `${BASE}/work-centers/[workCenterId]/edit`,
};
