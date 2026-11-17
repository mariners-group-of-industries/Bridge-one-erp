import type { Metadata } from "next";
import { CalendarView } from "@/features/ess/components/CalendarView";

export const instant = false;

export const metadata: Metadata = { title: "My Calendar" };

export default function EmployeeCalendarPage() {
  return <CalendarView />;
}
