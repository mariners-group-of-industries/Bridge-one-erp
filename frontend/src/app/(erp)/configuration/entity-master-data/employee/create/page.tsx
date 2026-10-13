import type { Metadata } from "next";
import { CreateEmployeeView } from "@/features/configuration/entity-master-data/employee/components/CreateEmployeeView";

export const instant = false;

export const metadata: Metadata = { title: "Create Employee" };

export default function CreateEmployeePage() {
  return <CreateEmployeeView />;
}
