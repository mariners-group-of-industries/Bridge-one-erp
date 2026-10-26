import { apiRequest } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type {
  ApprovedOrderQuery,
  ApprovedOrderRow,
  DeliveryDetail,
  DeliveryInput,
  DeliveryList,
  DeliveryListQuery,
  OrderForDelivery,
  PendingNote,
  StockAdjustmentInput,
  StockLevel,
  StockSummary,
  WarehouseOption,
} from "../schemas/delivery.schema";
import type { DriverOption, VehicleInput, VehicleOption } from "../schemas/vehicle.schema";

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
export const updateDeliveryReferences = (id: string, values: Record<string, unknown>) =>
  apiRequest<DeliveryDetail>(`${BASE}/${id}`, json("PATCH", values));
/** The delivery challan PDF: opened to print, or saved with `download`. */
export const challanPdfUrl = (id: string, download = false) => `${BASE}/${id}/challan-pdf${download ? "?download=1" : ""}`;
export const confirmDelivery = (id: string, version: string, actualDeliveryDate: string) =>
  apiRequest<DeliveryDetail>(`${BASE}/${id}/confirm`, json("POST", { version, actualDeliveryDate }));

export const fetchWarehouses = () => apiRequest<WarehouseOption[]>("/api/sales/warehouses");
export const fetchStock = (warehouseId: string, itemIds: string[]) =>
  apiRequest<StockLevel[]>(`/api/sales/stock${query({ warehouseId, itemIds: itemIds.join(",") })}`);
export const adjustStock = (input: StockAdjustmentInput) => apiRequest<void>("/api/sales/stock", json("POST", input));
export const fetchItemStock = (itemId: string) => apiRequest<StockSummary>(`/api/sales/items/${itemId}/stock`);

export const fetchPendingNotes = (orderId: string) => apiRequest<PendingNote[]>(`${BASE}/orders/${orderId}/pending-reason`);
export const addPendingNote = (orderId: string, reason: string) =>
  apiRequest<PendingNote[]>(`${BASE}/orders/${orderId}/pending-reason`, json("POST", { reason }));

export const fetchVehicles = (businessUnitId: string) => apiRequest<VehicleOption[]>(`/api/sales/vehicles${query({ businessUnitId })}`);
export const createVehicle = (input: VehicleInput) => apiRequest<VehicleOption>("/api/sales/vehicles", json("POST", input));
export const searchDrivers = (businessUnitId: string, search: string) =>
  apiRequest<DriverOption[]>(`/api/sales/drivers${query({ businessUnitId, search })}`);

/** Excel (.xlsx) of a Sales Delivery tab for the same filters. */
export const downloadDeliveryExcel = (tab: "approved" | "deliveries" | "exchanges" | "challans", filters: Record<string, unknown>) =>
  downloadFile(`${BASE}/export${query({ ...filters, tab })}`, `sales-delivery-${tab}.xlsx`);
