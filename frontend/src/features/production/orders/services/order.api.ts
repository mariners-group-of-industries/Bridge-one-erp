import { apiRequest } from "@/lib/api/client";
import type {
  CustomerOption,
  OrderActionInput,
  OrderDetail,
  OrderInput,
  OrderListQuery,
  OrderLookups,
  OrderPreview,
  OrderRow,
  OrderUpdate,
  SalesOrderOption,
} from "../schemas/order.schema";

const BASE = "/api/production/orders";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const params = (query: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));

export const fetchOrders = (query: OrderListQuery = {}) => apiRequest<OrderRow[]>(`${BASE}?${params(query)}`);
export const fetchOrder = (id: string) => apiRequest<OrderDetail>(`${BASE}/${id}`);
export const createOrder = (input: OrderInput) => apiRequest<OrderDetail>(BASE, json("POST", input));
export const updateOrder = (id: string, input: OrderUpdate) => apiRequest<OrderDetail>(`${BASE}/${id}`, json("PUT", input));
export const actOnOrder = (id: string, input: OrderActionInput) => apiRequest<OrderDetail>(`${BASE}/${id}/actions`, json("POST", input));
export const fetchOrderLookups = () => apiRequest<OrderLookups>(`${BASE}/lookups`);
export const fetchOrderPreview = (query: { bomId: string; itemId: string; quantity: number; warehouseId?: string }) =>
  apiRequest<OrderPreview>(`${BASE}/preview?${params(query)}`);
export const searchOrderCustomers = (search: string) => apiRequest<CustomerOption[]>(`${BASE}/customers?${params({ search })}`);
export const fetchCustomerSalesOrders = (customerId: string) => apiRequest<SalesOrderOption[]>(`${BASE}/customers/${customerId}/sales-orders`);
/** The printable PDF opens in a new tab. */
export const orderPdfUrl = (id: string) => `${BASE}/${id}/pdf`;
