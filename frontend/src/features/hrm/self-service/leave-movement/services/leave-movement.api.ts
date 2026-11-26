import { apiRequest } from "@/lib/api/client";
import type { AttendanceAdjustmentRow } from "@/features/hrm/attendance/services/attendance.service";
import type { AttendanceRecord } from "@/features/hrm/attendance/types";
import type { EmployeeOption, LeaveBalanceRow, LeaveInput, LeaveMovementOptions, LeaveDetail, LeaveRow, MovementDetail, MovementInput, MovementRow } from "../schemas/leave-movement.schema";

const BASE = "/api/hrm/self-service";
const withEmployee = (path: string, employeeId?: string) => (employeeId ? `${path}?employeeId=${encodeURIComponent(employeeId)}` : path);

export type ApplicationKind = "leaves" | "movements";

export const leaveMovementApi = {
  options: () => apiRequest<LeaveMovementOptions>(`${BASE}/leave-movement/options`),
  searchEmployees: (search: string) => apiRequest<EmployeeOption[]>(`${BASE}/leave-movement/employees?search=${encodeURIComponent(search)}`),

  balance: (employeeId?: string) => apiRequest<LeaveBalanceRow[]>(withEmployee(`${BASE}/leaves/balance`, employeeId)),
  leaves: () => apiRequest<LeaveRow[]>(`${BASE}/leaves`),
  leave: (id: string) => apiRequest<LeaveDetail>(`${BASE}/leaves/${id}`),
  movement: (id: string) => apiRequest<MovementDetail>(`${BASE}/movements/${id}`),
  applyLeave: (input: LeaveInput, files: File[]) => {
    const body = new FormData();
    body.set("data", JSON.stringify(input));
    for (const file of files) body.append("files", file);
    return apiRequest<{ id: string }>(`${BASE}/leaves`, { method: "POST", body });
  },
  attachmentUrl: (leaveId: string, attachmentId: string) => `${BASE}/leaves/${leaveId}/attachments/${attachmentId}`,

  movements: () => apiRequest<MovementRow[]>(`${BASE}/movements`),
  applyMovement: (input: MovementInput) => apiRequest<{ id: string }>(`${BASE}/movements`, { method: "POST", body: JSON.stringify(input) }),

  // Own attendance change requests (HR decides them in HR Governance › Pending Approval).
  attendanceDay: (date: string) => apiRequest<{ day: AttendanceRecord | null }>(`${BASE}/attendance-requests?date=${encodeURIComponent(date)}`),
  attendanceRequests: () => apiRequest<AttendanceAdjustmentRow[]>(`${BASE}/attendance-requests`),
  requestAttendance: (input: { date: string; requestedStatus: string; inTime: string; outTime: string; reason: string }) =>
    apiRequest<{ id: string }>(`${BASE}/attendance-requests`, { method: "POST", body: JSON.stringify(input) }),
  withdrawAttendance: (id: string) => apiRequest<void>(`${BASE}/attendance-requests/${id}/withdraw`, { method: "POST" }),

  decide: (kind: ApplicationKind, id: string, decision: "approve" | "reject") => apiRequest<void>(`${BASE}/${kind}/${id}/${decision}`, { method: "POST" }),
  remove: (kind: ApplicationKind, id: string) => apiRequest<void>(`${BASE}/${kind}/${id}`, { method: "DELETE" }),
};
