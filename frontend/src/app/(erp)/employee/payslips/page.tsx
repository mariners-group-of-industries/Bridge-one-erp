import type { Metadata } from "next";
import { PayslipsView } from "@/features/ess/components/PayslipViews";

export const instant = false;

export const metadata: Metadata = { title: "My Payslips" };

export default function EmployeePayslipsPage() {
  return <PayslipsView />;
}
