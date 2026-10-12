import { apiRequest } from "@/lib/api/client";
import type { DashboardQuery, SalesDashboard } from "../schemas/dashboard.schema";

export function fetchSalesDashboard(query: DashboardQuery): Promise<SalesDashboard> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.businessUnitId) params.set("businessUnitId", query.businessUnitId);
  return apiRequest<SalesDashboard>(`/api/sales/dashboard?${params}`);
}
