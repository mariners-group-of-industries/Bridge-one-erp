import type { Metadata } from "next";
import { UpdateProfileView } from "@/features/configuration/entity-master-data/employee/components/UpdateProfileView";

export const instant = false;

export const metadata: Metadata = { title: "Update Profile" };

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UpdateProfileView employeeId={id} />;
}
