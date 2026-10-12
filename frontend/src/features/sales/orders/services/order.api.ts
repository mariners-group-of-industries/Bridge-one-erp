import { apiRequest } from "@/lib/api/client";
import type { OrderAction, OrderDetail, OrderInput, OrderList, OrderListQuery } from "../schemas/order.schema";

const BASE = "/api/sales/orders";

export function fetchOrders(query: OrderListQuery): Promise<OrderList> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return apiRequest<OrderList>(`${BASE}?${params}`);
}

export const fetchOrder = (id: string) => apiRequest<OrderDetail>(`${BASE}/${id}`);

export const createOrder = (data: OrderInput) =>
  apiRequest<OrderDetail>(BASE, { method: "POST", body: JSON.stringify(data) });

export const updateOrder = (id: string, version: string, data: OrderInput) =>
  apiRequest<OrderDetail>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify({ version, data }) });

export const deleteOrder = (id: string) => apiRequest<void>(`${BASE}/${id}`, { method: "DELETE" });

export const changeOrderStatus = (id: string, action: OrderAction, version: string, today: string, remarks?: string) =>
  apiRequest<OrderDetail>(`${BASE}/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ action, version, today, remarks }),
  });
