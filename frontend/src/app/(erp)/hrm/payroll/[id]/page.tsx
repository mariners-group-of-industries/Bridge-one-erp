import type { Metadata } from "next";
import { PayrollBatchView } from "@/features/hrm/payroll/components/PayrollBatchView";

export const instant = false;

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayrollBatchView key={id} id={id} />;
}
