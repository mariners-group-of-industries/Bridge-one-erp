import type { Metadata } from "next";
import { SalaryGenerateView } from "@/features/hrm/payroll/components/SalaryGenerateView";

export const instant = false;

export const metadata: Metadata = { title: "Salary Generate" };

export default async function SalaryGeneratePage({ searchParams }: { searchParams: Promise<{ officeId?: string; month?: string; year?: string }> }) {
  const { officeId, month, year } = await searchParams;
  return <SalaryGenerateView initial={{ officeId, month, year }} />;
}
