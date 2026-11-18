import type { Metadata } from "next";
import { LeaveDetailView } from "@/features/ess/components/LeaveViews";

export const instant = false;

export const metadata: Metadata = { title: "Leave Application" };

export default async function EmployeeLeaveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeaveDetailView key={id} id={id} />;
}
