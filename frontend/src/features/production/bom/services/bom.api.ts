import { ApiClientError, apiRequest } from "@/lib/api/client";
import type {
  BomChildrenInput,
  BomDetail,
  BomInput,
  BomListQuery,
  BomLookups,
  BomOption,
  BomRow,
  BomUpdate,
} from "../schemas/bom.schema";

const BASE = "/api/production/bill-of-materials";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const params = (query: Record<string, string | boolean | undefined>) =>
  new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== "" && value !== false).map(([key, value]) => [key, String(value)]));

export const fetchBoms = (query: BomListQuery = {}) => apiRequest<BomRow[]>(`${BASE}?${params(query)}`);
export const fetchBom = (id: string) => apiRequest<BomDetail>(`${BASE}/${id}`);
export const createBom = (input: BomInput) => apiRequest<BomDetail>(BASE, json("POST", input));
export const updateBom = (id: string, input: BomUpdate) => apiRequest<BomDetail>(`${BASE}/${id}`, json("PUT", input));
export const deleteBom = (id: string, version: string) => apiRequest<void>(`${BASE}/${id}`, json("DELETE", { version }));
export const setBomActive = (id: string, version: string, isActive: boolean) => apiRequest<BomRow>(`${BASE}/${id}/status`, json("PUT", { version, isActive }));
export const setBomChildren = (id: string, input: BomChildrenInput) => apiRequest<BomDetail>(`${BASE}/${id}/children`, json("PUT", input));
export const fetchBomLookups = () => apiRequest<BomLookups>(`${BASE}/lookups`);
export const searchBomOptions = (search: string, exclude?: string) => apiRequest<BomOption[]>(`${BASE}/options?${params({ search, exclude })}`);

/** Downloads a file response (Excel / PDF); API errors are thrown like `apiRequest`. */
async function download(path: string, fallbackName: string) {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store" });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection.");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiClientError(response.status, "INTERNAL_ERROR", payload?.error?.message ?? `Download failed (${response.status}).`);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name ? decodeURIComponent(name) : fallbackName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const downloadBomList = (format: "xlsx" | "pdf", query: BomListQuery, details: boolean) =>
  download(`${BASE}/export?${params({ ...query, format, details })}`, `bill-of-material.${format}`);
export const downloadBomPdf = (id: string) => download(`${BASE}/${id}/pdf`, "bill-of-material.pdf");
