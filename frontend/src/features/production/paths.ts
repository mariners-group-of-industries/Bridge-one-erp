const BASE = "/production";

/** URLs of the production pages (keep in sync with src/app/(erp)/production). */
export const paths = {
  workspace: BASE,
  dashboard: `${BASE}/dashboard`,
  workCenters: `${BASE}/work-centers`,
  newWorkCenter: `${BASE}/work-centers/new`,
  editWorkCenter: (id: string) => `${BASE}/work-centers/${id}/edit`,
  billOfMaterials: `${BASE}/bill-of-materials`,
  newBom: `${BASE}/bill-of-materials/new`,
  copyBom: (id: string) => `${BASE}/bill-of-materials/new?copy=${id}`,
  editBom: (id: string) => `${BASE}/bill-of-materials/${id}/edit`,
  orders: `${BASE}/orders`,
  newOrder: `${BASE}/orders/new`,
  order: (id: string) => `${BASE}/orders/${id}`,
  editOrder: (id: string) => `${BASE}/orders/${id}/edit`,
  entries: `${BASE}/entries`,
  entryList: `${BASE}/entries?tab=list`,
  newEntry: (orderId: string) => `${BASE}/entries/new?orderId=${orderId}`,
  reports: `${BASE}/reports`,
};

/** Route patterns for breadcrumbs. */
export const patterns = {
  newWorkCenter: `${BASE}/work-centers/new`,
  editWorkCenter: `${BASE}/work-centers/[workCenterId]/edit`,
  newBom: `${BASE}/bill-of-materials/new`,
  editBom: `${BASE}/bill-of-materials/[bomId]/edit`,
  newOrder: `${BASE}/orders/new`,
  order: `${BASE}/orders/[orderId]`,
  editOrder: `${BASE}/orders/[orderId]/edit`,
  newEntry: `${BASE}/entries/new`,
};
