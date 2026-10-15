import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PermissionGroupFormView } from "@/features/configuration/security/groups/components/PermissionGroupFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Permission Group" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPermissionGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <PermissionGroupFormView groupId={id} />;
}
