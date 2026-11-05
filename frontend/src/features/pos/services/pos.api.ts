import { apiRequest } from "@/lib/api/client";
import type { CounterInput, PosCounter, PosPaymentMethod, PosSale } from "../schemas/pos.schema";
import type { PosDashboard, PosReportRow, PosReportTabId } from "../server/pos-reports.service";

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  uom: string;
  category: string;
  rate: number;
  inStock: number;
}

export interface SalePayload {
  counterId: string;
  customerName?: string;
  customerMobile?: string;
  tableRef?: string;
  discount: number;
  vatPercent: number;
  paymentMethod: PosPaymentMethod;
  paidAmount: number;
  lines: { itemId: string; qty: number; rate: number; discount: number }[];
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const query = (q: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const posApi = {
  terminalCounters: () => apiRequest<PosCounter[]>("/api/pos/terminal"),
  catalog: (counterId: string) => apiRequest<CatalogItem[]>(`/api/pos/terminal/catalog?${query({ counterId })}`),
  counterSales: (counterId: string) => apiRequest<PosSale[]>(`/api/pos/terminal/sales?${query({ counterId })}`),
  sell: (payload: SalePayload) => apiRequest<PosSale>("/api/pos/terminal", json("POST", payload)),
  voidSale: (id: string, reason: string) => apiRequest<PosSale>(`/api/pos/terminal/${id}/cancel`, json("POST", { reason })),
  counters: () => apiRequest<PosCounter[]>("/api/pos/setup/counters"),
  createCounter: (input: CounterInput) => apiRequest<PosCounter>("/api/pos/setup/counters", json("POST", input)),
  updateCounter: (id: string, patch: Partial<CounterInput> & { isActive?: boolean }) =>
    apiRequest<PosCounter>(`/api/pos/setup/counters/${id}`, json("PATCH", patch)),
  dashboard: (q: { from: string; to: string; year: number }) => apiRequest<PosDashboard>(`/api/pos/dashboard?${query(q)}`),
  reports: (q: { from: string; to: string }) => apiRequest<Record<PosReportTabId, PosReportRow[]>>(`/api/pos/reports?${query(q)}`),
};
