import { apiRequest } from "@/lib/api/client";
import type { DeviceFormOptions, DeviceInput, DeviceRow } from "../schemas/attendance-device.schema";

const BASE = "/api/configuration/gateways/attendance-devices";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const attendanceDeviceApi = {
  list: () => apiRequest<DeviceRow[]>(BASE),
  options: () => apiRequest<DeviceFormOptions>(`${BASE}/options`),
  create: (input: DeviceInput) => apiRequest<{ id: string }>(BASE, json("POST", input)),
  update: (id: string, input: DeviceInput) => apiRequest<{ id: string }>(`${BASE}/${id}`, json("PUT", input)),
  remove: (id: string) => apiRequest<void>(`${BASE}/${id}`, { method: "DELETE" }),
};
