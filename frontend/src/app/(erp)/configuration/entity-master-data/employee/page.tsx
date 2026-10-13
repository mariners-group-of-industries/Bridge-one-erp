import type { Metadata } from "next";
import { EmployeeListView } from "@/features/configuration/entity-master-data/employee/components/EmployeeListView";

export const instant = false;

export const metadata: Metadata = { title: "Employee Management" };

export default function EmployeePage() {
  return <EmployeeListView />;
}
