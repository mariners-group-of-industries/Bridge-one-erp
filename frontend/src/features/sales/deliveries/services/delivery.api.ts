import { apiRequest } from "@/lib/api/client";
import type {
  ApprovedOrderQuery,
  ApprovedOrderRow,
  DeliveryDetail,
  DeliveryInput,
  DeliveryList,
  DeliveryListQuery,
  OrderForDelivery,
  StockAdjustmentInput,
  StockLevel,
  StockSummary,
  WarehouseOption,
} from "../schemas/delivery.schema";

const BASE = "/api/sales/deliveries";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function query(values: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) params.set(key, String(value));
  }
  return params.size ? `?${params}` : "";
}

export const fetchApprovedOrders = (filters: ApprovedOrderQuery) => apiRequest<ApprovedOrderRow[]>(`${BASE}/approved-orders${query(filters)}`);
export const fetchOrderForDelivery = (orderId: string, asOf: string, editing?: string) =>
  apiRequest<OrderForDelivery>(`${BASE}/orders/${orderId}${query({ asOf, editing })}`);
export const setPendingReason = (orderId: string, reasonId: string | null) =>
  apiRequest<void>(`${BASE}/orders/${orderId}/pending-reason`, json("PUT", { reasonId }));

export const fetchDeliveries = (filters: DeliveryListQuery) => apiRequest<DeliveryList>(`${BASE}${query(filters)}`);
export const fetchDelivery = (id: string) => apiRequest<DeliveryDetail>(`${BASE}/${id}`);
export const createDelivery = (input: DeliveryInput) => apiRequest<DeliveryDetail>(BASE, json("POST", input));
export const updateDelivery = (id: string, version: string, data: DeliveryInput) =>
  apiRequest<DeliveryDetail>(`${BASE}/${id}`, json("PUT", { version, data }));
export const deleteDelivery = (id: string, version: string, reason: string) =>
  apiRequest<void>(`${BASE}/${id}`, json("DELETE", { version, reason }));
export const confirmDelivery = (id: string, version: string, actualDeliveryDate: string) =>
  apiRequest<DeliveryDetail>(`${BASE}/${id}/confirm`, json("POST", { version, actualDeliveryDate }));

export const fetchWarehouses = () => apiRequest<WarehouseOption[]>("/api/sales/warehouses");
export const fetchStock = (warehouseId: string, itemIds: string[]) =>
  apiRequest<StockLevel[]>(`/api/sales/stock${query({ warehouseId, itemIds: itemIds.join(",") })}`);
export const adjustStock = (input: StockAdjustmentInput) => apiRequest<void>("/api/sales/stock", json("POST", input));
export const fetchItemStock = (itemId: string) => apiRequest<StockSummary>(`/api/sales/items/${itemId}/stock`);
