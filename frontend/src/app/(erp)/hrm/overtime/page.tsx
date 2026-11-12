import type { Metadata } from "next";
import { OvertimeView } from "@/features/hrm/overtime/components/OvertimeView";

export const instant = false;

export const metadata: Metadata = { title: "Overtime" };

export default function OvertimePage() {
  return <OvertimeView />;
}
