import { apiRequest } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type { OrderAction, OrderAttachment, OrderDetail, OrderInput, OrderList, OrderListQuery } from "../schemas/order.schema";

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

/** The order as a PDF: opened in a tab to print, or saved with `download`. */
export const orderPdfUrl = (id: string, download = false) => `${BASE}/${id}/pdf${download ? "?download=1" : ""}`;

export const downloadOrderExcel = (id: string, number: string) => downloadFile(`${BASE}/${id}/excel`, `${number}.xlsx`);

/** Order Management (.xlsx) for the same filters as the list. */
export function downloadOrdersExcel(query: OrderListQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return downloadFile(`${BASE}/export?${params}`, "sales-orders.xlsx");
}

export const changeOrderStatus =(id: string, action: OrderAction, version: string, today: string, remarks?: string) =>
  apiRequest<OrderDetail>(`${BASE}/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ action, version, today, remarks }),
  });

/** Upload one file to the order (multipart, field `file`). */
export function addOrderAttachment(id: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return apiRequest<OrderAttachment>(`${BASE}/${id}/attachments`, { method: "POST", body: form });
}

export const deleteOrderAttachment = (id: string, attachmentId: string) =>
  apiRequest<void>(`${BASE}/${id}/attachments/${attachmentId}`, { method: "DELETE" });

export const orderAttachmentUrl = (id: string, attachmentId: string) => `${BASE}/${id}/attachments/${attachmentId}`;
