import { apiRequest } from "@/lib/api/client";
import type { EntryDetail, EntryForm, EntryInput, EntryListQuery, EntryRow, QueueRow } from "../schemas/entry.schema";

const BASE = "/api/production/entries";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const params = (query: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== "") as [string, string][]);

export const fetchEntryQueue = (search?: string) => apiRequest<QueueRow[]>(`${BASE}/approved-orders?${params({ search })}`);
export const fetchEntries = (query: EntryListQuery = {}) => apiRequest<EntryRow[]>(`${BASE}?${params(query)}`);
export const fetchEntry = (id: string) => apiRequest<EntryDetail>(`${BASE}/${id}`);
export const fetchEntryForm = (orderId: string) => apiRequest<EntryForm>(`${BASE}/form?${params({ orderId })}`);
export const createEntry = (input: EntryInput) => apiRequest<EntryDetail>(BASE, json("POST", input));
export const cancelEntry = (id: string, version: string, reason: string) => apiRequest<EntryDetail>(`${BASE}/${id}/cancel`, json("POST", { version, reason }));
/** The printable slip opens in a new tab. */
export const entryPdfUrl = (id: string) => `${BASE}/${id}/pdf`;
