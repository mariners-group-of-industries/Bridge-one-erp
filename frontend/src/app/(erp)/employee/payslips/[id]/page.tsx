import type { Metadata } from "next";
import { PayslipView } from "@/features/ess/components/PayslipViews";

export const instant = false;

export const metadata: Metadata = { title: "Payslip" };

export default async function EmployeePayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayslipView key={id} id={id} />;
}
