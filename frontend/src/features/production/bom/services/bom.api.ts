import { apiRequest } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
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

export const downloadBomList = (format: "xlsx" | "pdf", query: BomListQuery, details: boolean) =>
  downloadFile(`${BASE}/export?${params({ ...query, format, details })}`, `bill-of-material.${format}`);
export const downloadBomPdf = (id: string) => downloadFile(`${BASE}/${id}/pdf`, "bill-of-material.pdf");
