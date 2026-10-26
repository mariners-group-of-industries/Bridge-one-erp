import type { Metadata } from "next";
import { UserGroupFormView } from "@/features/configuration/security/groups/components/UserGroupFormView";

export const instant = false;

export const metadata: Metadata = { title: "Add User Group" };

export default function NewUserGroupPage() {
  return <UserGroupFormView />;
}
