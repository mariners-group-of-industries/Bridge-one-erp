import { apiRequest } from "@/lib/api/client";
import type { ProductionDashboard, ProductionDashboardQuery } from "../schemas/dashboard.schema";

export function fetchProductionDashboard(query: ProductionDashboardQuery): Promise<ProductionDashboard> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.officeId) params.set("officeId", query.officeId);
  return apiRequest<ProductionDashboard>(`/api/production/dashboard?${params}`);
}
