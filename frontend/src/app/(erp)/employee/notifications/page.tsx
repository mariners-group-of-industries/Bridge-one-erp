import type { Metadata } from "next";
import { NotificationsView } from "@/features/ess/components/NotificationsView";

export const instant = false;

export const metadata: Metadata = { title: "Notifications" };

export default function EmployeeNotificationsPage() {
  return <NotificationsView />;
}
