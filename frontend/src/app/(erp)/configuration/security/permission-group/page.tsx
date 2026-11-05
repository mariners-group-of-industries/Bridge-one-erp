import type { Metadata } from "next";
import { PermissionGroupListView } from "@/features/configuration/security/access/components/PermissionGroupListView";

export const instant = false;

export const metadata: Metadata = { title: "Permission Groups" };

export default function PermissionGroupPage() {
  return <PermissionGroupListView />;
}
