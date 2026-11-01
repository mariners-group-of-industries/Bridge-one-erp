import type { Metadata } from "next";
import { PermissionGroupFormView } from "@/features/configuration/security/access/components/PermissionGroupFormView";

export const instant = false;

export const metadata: Metadata = { title: "Add Permission Group" };

export default function NewPermissionGroupPage() {
  return <PermissionGroupFormView />;
}
