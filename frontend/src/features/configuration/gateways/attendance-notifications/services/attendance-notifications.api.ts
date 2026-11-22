import { apiRequest } from "@/lib/api/client";
import type { NotificationSettingInput } from "../schemas/attendance-notification.schema";

export interface NotificationSettingsDto {
  id: string | null;
  enabled: boolean;
  notifyCheckIn: boolean;
  notifyLate: boolean;
  notifyCheckOut: boolean;
  whatsappGroupId: string | null;
  whatsappGroupName: string | null;
  departmentFilter: string | null;
  messageTemplate: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface NotificationOutboxRow {
  id: string;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  attendanceDate: string;
  eventType: string;
  attendanceStatus: string;
  punchTime: string;
  groupId: string;
  messageText: string;
  status: string;
  attempts: number;
  gatewayMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationDashboardDto {
  settings: NotificationSettingsDto;
  gateway: {
    configured: boolean;
    connected: boolean;
    phone: string | null;
    qrPending: boolean;
    error?: string;
  };
  groups: Array<{ id: string; name: string }>;
  summary: { pending: number; sent: number; failed: number };
  logs: NotificationOutboxRow[];
}

const BASE = "/api/configuration/gateways/attendance-notifications";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const attendanceNotificationsApi = {
  dashboard: () => apiRequest<NotificationDashboardDto>(BASE),
  saveSettings: (body: NotificationSettingInput) => apiRequest<NotificationSettingsDto>(BASE, json("PUT", body)),
  sendTest: (body: { groupId?: string | null; message?: string }) =>
    apiRequest<{ accepted: boolean; messageId: string | null }>(`${BASE}/test`, json("POST", body)),
  processQueue: () => apiRequest<{ sent: number }>(`${BASE}/process`, json("POST", {})),
  retryItem: (id: string) => apiRequest<NotificationOutboxRow>(`${BASE}/outbox/${id}/retry`, json("POST", {})),
};
