import type { Metadata } from "next";
import { GroupListView } from "@/features/configuration/security/groups/components/GroupListView";

export const instant = false;

export const metadata: Metadata = { title: "Permission Group" };

export default function PermissionGroupPage() {
  return <GroupListView kind="permission" />;
}
