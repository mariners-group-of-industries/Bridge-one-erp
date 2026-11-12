import type { Metadata } from "next";
import { EmployeePermissionView } from "@/features/configuration/entity-master-data/employee/components/EmployeePermissionView";

export const instant = false;

export const metadata: Metadata = { title: "Employee Permission" };

export default async function EmployeePermissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeePermissionView employeeId={id} />;
}
