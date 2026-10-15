import type { Metadata } from "next";
import { GroupListView } from "@/features/configuration/security/groups/components/GroupListView";

export const instant = false;

export const metadata: Metadata = { title: "User Group" };

export default function UserGroupPage() {
  return <GroupListView kind="user" />;
}
