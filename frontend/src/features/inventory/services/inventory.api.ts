import { apiRequest } from "@/lib/api/client";
import type { InventoryDocSlug, InventoryDocument } from "../schemas/document.schema";
import type { InventoryOverview, InventoryReportRow, LedgerRow } from "../server/overview.service";

export interface WarehouseOption {
  id: string;
  name: string;
  officeName: string;
  businessUnitId: string;
}

export interface ItemOption {
  id: string;
  code: string;
  name: string;
  uom: string;
  businessUnitId: string;
  category: string;
}

export interface InventoryMasters {
  warehouses: WarehouseOption[];
  items: ItemOption[];
}

export interface StockOnHand {
  warehouseId: string;
  itemId: string;
  qty: number;
}

export interface DocumentLineInput {
  itemId: string;
  qty: number;
  toItemId?: string;
  toQty?: number;
  remarks?: string;
}

export interface DocumentInput {
  docDate: string;
  expectedDate?: string;
  warehouseId?: string;
  toWarehouseId?: string;
  requestId?: string;
  subtype?: string;
  partyName?: string;
  reference?: string;
  remarks?: string;
  meta?: Record<string, string>;
  lines: DocumentLineInput[];
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const query = (q: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

export const inventoryApi = {
  masters: () => apiRequest<InventoryMasters>("/api/inventory/masters"),
  stock: (warehouseId?: string) => apiRequest<StockOnHand[]>(`/api/inventory/stock?${query({ warehouseId })}`),
  list: (slug: InventoryDocSlug, q: { from?: string; to?: string; status?: string } = {}) =>
    apiRequest<InventoryDocument[]>(`/api/inventory/${slug}?${query(q)}`),
  create: (slug: InventoryDocSlug, input: DocumentInput) => apiRequest<InventoryDocument>(`/api/inventory/${slug}`, json("POST", input)),
  review: (slug: InventoryDocSlug, id: string, decision: "approve" | "reject", comment?: string) =>
    apiRequest<InventoryDocument>(`/api/inventory/${slug}/${id}/${decision}`, json("POST", { comment })),
  receive: (id: string, lines: { lineId: string; receivedQty: number }[], receiveDate?: string) =>
    apiRequest<InventoryDocument>(`/api/inventory/transfer/${id}/receive`, json("POST", { lines, receiveDate })),
  completeGatePass: (id: string) => apiRequest<InventoryDocument>(`/api/inventory/gate-in-out/${id}/complete`, json("POST", {})),
  overview: (q: { from: string; to: string; warehouseId?: string; category?: string }) =>
    apiRequest<InventoryOverview>(`/api/inventory/overview?${query(q)}`),
  ledger: (q: { from: string; to: string; warehouseId?: string; category?: string; itemId?: string }) =>
    apiRequest<LedgerRow[]>(`/api/inventory/stock-ledger?${query(q)}`),
  inventoryReport: (q: { from: string; to: string; warehouseId?: string; category?: string }) =>
    apiRequest<InventoryReportRow[]>(`/api/inventory/inventory-reports?${query(q)}`),
  transferReport: (q: { from?: string; to?: string }) =>
    apiRequest<{ transfers: InventoryDocument[]; requests: InventoryDocument[] }>(`/api/inventory/transfer-report?${query(q)}`),
};

/** Status names the inventory screens show. */
export const STATUS_LABEL: Record<InventoryDocument["status"], string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  IN_TRANSIT: "In Transit",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** "YYYY-MM-DD" → "DD-MM-YYYY", as the inventory tables show dates. */
export const dmy = (date: string | null | undefined) => (date ? date.split("-").reverse().join("-") : "");
export const today = () => new Date().toISOString().slice(0, 10);
export const monthAgo = () => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
