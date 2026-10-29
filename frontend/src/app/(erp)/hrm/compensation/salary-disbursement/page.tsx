import type { Metadata } from "next";
import { SalaryDisbursementView } from "@/features/hrm/payroll/components/SalaryDisbursementView";

export const instant = false;

export const metadata: Metadata = { title: "Salary Disbursement" };

export default async function SalaryDisbursementPage({ searchParams }: { searchParams: Promise<{ tab?: string; officeId?: string; month?: string }> }) {
  const { tab, officeId, month } = await searchParams;
  return <SalaryDisbursementView initial={{ tab, officeId, month }} />;
}
