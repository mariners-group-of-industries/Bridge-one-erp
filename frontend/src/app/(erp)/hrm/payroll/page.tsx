import type { Metadata } from "next";
import { PayrollView } from "@/features/hrm/payroll/components/PayrollView";

export const instant = false;

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollPage() {
  return <PayrollView />;
}
