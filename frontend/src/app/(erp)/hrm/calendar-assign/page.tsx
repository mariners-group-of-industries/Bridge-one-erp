import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page";
import { DynamicCalendarView } from "@/features/hrm/calendar-assign/components/DynamicCalendarView";
import type { CalendarAssignMeta } from "@/features/hrm/calendar-assign/services/calendar-assign.service";

export const instant = false;

export const metadata: Metadata = {
  title: "Dynamic Calendar - Calendar Assign | BridgeOne ERP",
  description:
    "Assign and manage dynamic employee calendars, shift rosters, and work timings across offices and factory units.",
};

const emptyOptions: CalendarAssignMeta = {
  offices: [],
  departments: [],
  departmentSections: [],
  designations: [],
  employeeOptions: [],
};

export default function CalendarAssignPage() {
  return (
    <PageContainer full className="pt-2">
      <DynamicCalendarView
        initialEmployees={[]}
        initialOptions={emptyOptions}
      />
    </PageContainer>
  );
}
