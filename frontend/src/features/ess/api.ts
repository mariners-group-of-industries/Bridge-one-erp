import { apiRequest } from "@/lib/api/client";
import type {
  EssAttendanceMonth,
  EssCalendarMonth,
  EssCorrection,
  EssDashboard,
  EssDayDetail,
  EssLeaveDetail,
  EssLeaveOverview,
  EssLeavePreview,
  EssMe,
  EssNotifications,
  EssPayslip,
  EssPayslipRow,
  EssProfile,
} from "./types";

const BASE = "/api/ess";
const query = (params: Record<string, string | number | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
  const text = q.toString();
  return text ? `?${text}` : "";
};

/** Employee Self Service API: every call works on the signed-in employee only. */
export const essApi = {
  me: () => apiRequest<EssMe>(`${BASE}/me`),
  photoUrl: `${BASE}/photo`,
  dashboard: () => apiRequest<EssDashboard>(`${BASE}/dashboard`),
  profile: () => apiRequest<EssProfile>(`${BASE}/profile`),

  attendance: (params: { month?: string; from?: string; to?: string; status?: string }) => apiRequest<EssAttendanceMonth>(`${BASE}/attendance${query(params)}`),
  day: (date: string) => apiRequest<EssDayDetail>(`${BASE}/attendance/day${query({ date })}`),
  calendar: (month: string) => apiRequest<EssCalendarMonth>(`${BASE}/calendar${query({ month })}`),

  corrections: () => apiRequest<EssCorrection[]>(`${BASE}/attendance-corrections`),
  requestCorrection: (input: { date: string; correctionType: string; requestedStatus: string; inTime: string; outTime: string; reason: string }) =>
    apiRequest<{ id: string; warning: string | null }>(`${BASE}/attendance-corrections`, { method: "POST", body: JSON.stringify(input) }),
  withdrawCorrection: (id: string) => apiRequest<void>(`${BASE}/attendance-corrections/${id}/withdraw`, { method: "POST" }),

  leave: (year?: number) => apiRequest<EssLeaveOverview>(`${BASE}/leave${query({ year })}`),
  leaveDetail: (id: string) => apiRequest<EssLeaveDetail>(`${BASE}/leave/${id}`),
  previewLeave: (input: { leaveType: string; fromDate: string; toDate: string }) => apiRequest<EssLeavePreview>(`${BASE}/leave/preview`, { method: "POST", body: JSON.stringify(input) }),
  applyLeave: (input: { leaveType: string; fromDate: string; toDate: string; reason: string; contact: string }, files: File[]) => {
    const body = new FormData();
    body.set("data", JSON.stringify(input));
    for (const file of files) body.append("files", file);
    return apiRequest<{ id: string; days: number; reference: string }>(`${BASE}/leave`, { method: "POST", body });
  },
  cancelLeave: (id: string) => apiRequest<void>(`${BASE}/leave/${id}/cancel`, { method: "POST" }),
  attachmentUrl: (leaveId: string, attachmentId: string) => `${BASE}/leave/${leaveId}/attachments/${attachmentId}`,

  payslips: () => apiRequest<EssPayslipRow[]>(`${BASE}/payslips`),
  payslip: (id: string) => apiRequest<EssPayslip>(`${BASE}/payslips/${id}`),

  notifications: (limit = 50) => apiRequest<EssNotifications>(`${BASE}/notifications${query({ limit })}`),
  markRead: (id?: string) => apiRequest<{ updated: number }>(`${BASE}/notifications/read`, { method: "POST", body: JSON.stringify(id ? { id } : {}) }),
};
