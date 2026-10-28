import { apiRequest } from "@/lib/api/client";
import type { EmployeeOption, LeaveBalanceRow, LeaveInput, LeaveMovementOptions, LeaveRow, MovementInput, MovementRow } from "../schemas/leave-movement.schema";

const BASE = "/api/hrm/self-service";
const withEmployee = (path: string, employeeId?: string) => (employeeId ? `${path}?employeeId=${encodeURIComponent(employeeId)}` : path);

export type ApplicationKind = "leaves" | "movements";

export const leaveMovementApi = {
  options: () => apiRequest<LeaveMovementOptions>(`${BASE}/leave-movement/options`),
  searchEmployees: (search: string) => apiRequest<EmployeeOption[]>(`${BASE}/leave-movement/employees?search=${encodeURIComponent(search)}`),

  balance: (employeeId?: string) => apiRequest<LeaveBalanceRow[]>(withEmployee(`${BASE}/leaves/balance`, employeeId)),
  leaves: () => apiRequest<LeaveRow[]>(`${BASE}/leaves`),
  applyLeave: (input: LeaveInput, files: File[]) => {
    const body = new FormData();
    body.set("data", JSON.stringify(input));
    for (const file of files) body.append("files", file);
    return apiRequest<{ id: string }>(`${BASE}/leaves`, { method: "POST", body });
  },
  attachmentUrl: (leaveId: string, attachmentId: string) => `${BASE}/leaves/${leaveId}/attachments/${attachmentId}`,

  movements: () => apiRequest<MovementRow[]>(`${BASE}/movements`),
  applyMovement: (input: MovementInput) => apiRequest<{ id: string }>(`${BASE}/movements`, { method: "POST", body: JSON.stringify(input) }),

  decide: (kind: ApplicationKind, id: string, decision: "approve" | "reject") => apiRequest<void>(`${BASE}/${kind}/${id}/${decision}`, { method: "POST" }),
  remove: (kind: ApplicationKind, id: string) => apiRequest<void>(`${BASE}/${kind}/${id}`, { method: "DELETE" }),
};
