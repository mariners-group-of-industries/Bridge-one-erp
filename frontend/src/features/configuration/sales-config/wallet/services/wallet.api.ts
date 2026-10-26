import { apiRequest } from "@/lib/api/client";
import type { WalletDto, WalletFormOptions, WalletInput, WalletList } from "../schemas/wallet.schema";

const BASE = "/api/configuration/sales-config/wallets";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();

export const walletApi = {
  list: (params: { search?: string; page: number; pageSize: number }) => apiRequest<WalletList>(`${BASE}?${query(params)}`),
  formOptions: () => apiRequest<WalletFormOptions>(`${BASE}/options`),
  get: (id: string) => apiRequest<WalletDto>(`${BASE}/${id}`),
  create: (input: WalletInput) => apiRequest<WalletDto>(BASE, json("POST", input)),
  update: (id: string, input: WalletInput) => apiRequest<WalletDto>(`${BASE}/${id}`, json("PUT", input)),
  remove: (id: string) => apiRequest<void>(`${BASE}/${id}`, { method: "DELETE" }),
  attachmentUrl: (id: string) => `${BASE}/${id}/attachment`,
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return apiRequest<WalletDto>(`${BASE}/${id}/attachment`, { method: "POST", body: form });
  },
  removeAttachment: (id: string) => apiRequest<void>(`${BASE}/${id}/attachment`, { method: "DELETE" }),
};
