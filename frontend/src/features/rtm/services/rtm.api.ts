import { apiRequest } from "@/lib/api/client";

/** Calls an RTM API path (/api/rtm/<path>). */
const url = (path: string, q?: Record<string, string | undefined>) => {
  const params = q ? new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString() : "";
  return `/api/rtm/${path}${params ? `?${params}` : ""}`;
};

export const rtmApi = {
  get: <T>(path: string, q?: Record<string, string | undefined>) => apiRequest<T>(url(path, q)),
  post: <T>(path: string, body: unknown = {}) => apiRequest<T>(url(path), { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(url(path), { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => apiRequest<T>(url(path), { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => apiRequest<T>(url(path), { method: "DELETE" }),
};

export interface Lookups {
  distributors: { id: string; code: string; name: string; businessUnitId: string }[];
  outlets: { id: string; code: string; name: string; distributorId: string; channelId: string | null; routeId: string | null }[];
  channels: { id: string; code: string; name: string }[];
  routes: { id: string; name: string }[];
  srs: { id: string; code: string; name: string; designation: string | null }[];
  items: { id: string; code: string; name: string; uom: string; rate: number; businessUnitId: string }[];
}

export const today = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;
export const thisMonth = () => new Date().toISOString().slice(0, 7);
export const money = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const qty = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
