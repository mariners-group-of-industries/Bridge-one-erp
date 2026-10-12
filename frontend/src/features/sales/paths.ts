const BASE = "/sales";

/** URLs of the sales pages (keep in sync with src/app/(erp)/sales and src/app/(print)). */
export const paths = {
  workspace: BASE,
  dashboard: `${BASE}/dashboard`,
  quotations: `${BASE}/quotations`,
  newQuotation: `${BASE}/quotations/new`,
  quotation: (id: string) => `${BASE}/quotations/${id}`,
  orders: `${BASE}/orders`,
  newOrder: `${BASE}/orders/new`,
  order: (id: string) => `${BASE}/orders/${id}`,
  editOrder: (id: string) => `${BASE}/orders/${id}/edit`,
  printOrder: (id: string) => `/print/sales/orders/${id}`,
  deliveries: `${BASE}/deliveries`,
  returns: `${BASE}/returns`,
  collections: `${BASE}/collections`,
  targets: `${BASE}/targets`,
  reports: `${BASE}/reports`,
  analytics: `${BASE}/analytics`,
  setup: `${BASE}/setup`,
};

/** Route patterns for breadcrumbs ("new" first: it also matches the [id] pattern). */
export const patterns = {
  newQuotation: `${BASE}/quotations/new`,
  quotation: `${BASE}/quotations/[quotationId]`,
  newOrder: `${BASE}/orders/new`,
  order: `${BASE}/orders/[orderId]`,
  editOrder: `${BASE}/orders/[orderId]/edit`,
};
