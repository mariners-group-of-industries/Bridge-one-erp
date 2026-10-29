import { apiRequest } from "@/lib/api/client";
import type {
  AssignInput,
  BudgetDetail,
  BudgetInput,
  BudgetRow,
  CommissionDetail,
  CommissionInput,
  CommissionReport,
  CommissionReportQuery,
  CommissionRow,
  PlanDetail,
  PlanInput,
  PlanListQuery,
  PlanReportQuery,
  PlanReportRow,
  PlanRow,
  TargetReportQuery,
  TargetReportRow,
} from "../schemas/target.schema";

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function query(values: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) params.set(key, String(value));
  }
  return params.size ? `?${params}` : "";
}

const T = "/api/sales/targets";
export const fetchBudgets = () => apiRequest<BudgetRow[]>(`${T}/budgets`);
export const fetchBudget = (id: string) => apiRequest<BudgetDetail>(`${T}/budgets/${id}`);
export const createBudget = (input: BudgetInput) => apiRequest<BudgetDetail>(`${T}/budgets`, json("POST", input));
export const updateBudget = (id: string, version: string, data: BudgetInput) => apiRequest<BudgetDetail>(`${T}/budgets/${id}`, json("PUT", { version, data }));
export const saveBudgetPerson = (id: string, salesPersonId: string, months: { month: number; value: number }[]) =>
  apiRequest<BudgetDetail>(`${T}/budgets/${id}/persons`, json("PUT", { salesPersonId, months }));
export const deleteBudget = (id: string) => apiRequest<void>(`${T}/budgets/${id}`, { method: "DELETE" });
export const fetchTargetReport = (filters: TargetReportQuery) => apiRequest<TargetReportRow[]>(`${T}/report${query(filters)}`);

export const fetchPlans = (filters: PlanListQuery) => apiRequest<PlanRow[]>(`${T}/plans${query(filters)}`);
export const fetchPlan = (id: string) => apiRequest<PlanDetail>(`${T}/plans/${id}`);
export const createPlan = (input: PlanInput) => apiRequest<PlanDetail>(`${T}/plans`, json("POST", input));
export const updatePlan = (id: string, version: string, data: PlanInput) => apiRequest<PlanDetail>(`${T}/plans/${id}`, json("PUT", { version, data }));
export const deletePlan = (id: string) => apiRequest<void>(`${T}/plans/${id}`, { method: "DELETE" });
export const assignPlan = (input: AssignInput) => apiRequest<PlanDetail>(`${T}/plans/assign`, json("POST", input));
export const deleteAssignment = (id: string) => apiRequest<void>(`${T}/assignments/${id}`, { method: "DELETE" });
export const fetchPlanReport = (filters: PlanReportQuery) => apiRequest<PlanReportRow[]>(`${T}/plan-report${query(filters)}`);

const C = "/api/sales/commissions";
export const fetchCommissions = () => apiRequest<CommissionRow[]>(C);
export const fetchCommission = (id: string) => apiRequest<CommissionDetail>(`${C}/${id}`);
export const createCommission = (input: CommissionInput) => apiRequest<CommissionDetail>(C, json("POST", input));
export const updateCommission = (id: string, version: string, data: CommissionInput) => apiRequest<CommissionDetail>(`${C}/${id}`, json("PUT", { version, data }));
export const deleteCommission = (id: string) => apiRequest<void>(`${C}/${id}`, { method: "DELETE" });
export const fetchCommissionReport = (filters: CommissionReportQuery) => apiRequest<CommissionReport>(`${C}/report${query(filters)}`);
